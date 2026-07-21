"""Seller & Rider Settlement Engine — Points 3 & 4.

Auto-creates per-delivered-order earnings records when a delivery is verified,
then bundles pending earnings into Settlement batches that an admin marks paid.

Collections:
- seller_earnings, seller_settlements
- rider_earnings, rider_settlements

Rider payment models (configurable in business_rules):
- per_delivery : flat base per delivery
- per_km      : distance * per_km_pay
- hybrid      : base + distance * per_km_pay
- salary      : ₹0 per delivery (rider is on fixed monthly salary)

Plus optional bonus after N deliveries in a day.
"""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from audit import log_event
from auth import require_admin
from db import get_db
from models import SettlementCreate, SettlementMarkPaid, new_id, utcnow

router = APIRouter(tags=["settlements"])


# =========================================================== EARNINGS AUTO-CREATE (called from order flow)
async def create_earnings_for_delivered_order(db, order: dict, delivery: dict | None) -> dict:
    """Idempotent — creates seller_earnings (one per unique seller in the order)
    and rider_earnings (one per delivery) records. Called from verify_delivery."""
    now = utcnow()
    result = {"seller_earnings": [], "rider_earning": None}

    # ---- SELLER EARNINGS (Point 3) ----
    if not await db.seller_earnings.find_one({"order_id": order["id"]}):
        by_seller: dict[str, dict[str, float]] = {}
        for line in order.get("items", []):
            sid = line.get("seller_id")
            if not sid:
                continue
            g = line["price"] * line["qty"]
            c = float(line.get("line_commission", 0))
            agg = by_seller.setdefault(sid, {"gross": 0.0, "commission": 0.0, "line_count": 0})
            agg["gross"] += g
            agg["commission"] += c
            agg["line_count"] += 1

        for sid, agg in by_seller.items():
            doc = {
                "id": new_id(),
                "seller_id": sid,
                "order_id": order["id"],
                "gross_sales": round(agg["gross"], 2),
                "commission": round(agg["commission"], 2),
                "net_earning": round(agg["gross"] - agg["commission"], 2),
                "line_count": agg["line_count"],
                "status": "pending",
                "settlement_id": None,
                "created_at": now,
                "delivered_at": order.get("updated_at", now),
            }
            await db.seller_earnings.insert_one(doc)
            doc.pop("_id", None)
            result["seller_earnings"].append(doc)

    # ---- RIDER EARNINGS (Point 4) ----
    if delivery and delivery.get("rider_id") and not await db.rider_earnings.find_one({"order_id": order["id"]}):
        rules = await db.business_rules.find_one({"id": "default"}, {"_id": 0}) or {}
        model = rules.get("rider_payment_model", "hybrid")
        base = float(rules.get("rider_base_pay", 20) or 0)
        per_km = float(rules.get("rider_per_km_pay", 5) or 0)
        distance = float((order.get("delivery_breakdown") or {}).get("distance_km", 0))

        base_component = base if model in ("per_delivery", "hybrid") else 0.0
        distance_component = round(distance * per_km, 2) if model in ("per_km", "hybrid") else 0.0

        # Daily bonus
        bonus = 0.0
        thr = rules.get("rider_bonus_per_delivery_after")
        bonus_amt = float(rules.get("rider_bonus_amount", 0) or 0)
        if thr and bonus_amt > 0:
            day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            todays = await db.rider_earnings.count_documents({"rider_id": delivery["rider_id"], "created_at": {"$gte": day_start}})
            if todays + 1 > int(thr):
                bonus = bonus_amt

        total = round(base_component + distance_component + bonus, 2)

        doc = {
            "id": new_id(),
            "rider_id": delivery["rider_id"],
            "order_id": order["id"],
            "delivery_id": delivery["id"],
            "model": model,
            "distance_km": round(distance, 2),
            "base_pay": base_component,
            "per_km_pay": distance_component,
            "bonus": bonus,
            "total_earning": total,
            "status": "pending",
            "settlement_id": None,
            "created_at": now,
        }
        await db.rider_earnings.insert_one(doc)
        doc.pop("_id", None)
        result["rider_earning"] = doc

    return result


# =========================================================== SELLER (Point 3)
@router.get("/seller-earnings")
async def list_seller_earnings(
    seller_id: str | None = None,
    status: str | None = None,
    limit: int = Query(200, le=1000),
    _: dict = Depends(require_admin),
):
    db = get_db()
    filt: dict = {}
    if seller_id:
        filt["seller_id"] = seller_id
    if status:
        filt["status"] = status
    items = await db.seller_earnings.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"items": items, "total": len(items)}


@router.get("/sellers/{seller_id}/dashboard")
async def seller_dashboard(seller_id: str, _: dict = Depends(require_admin)):
    db = get_db()
    agg = await db.seller_earnings.aggregate([
        {"$match": {"seller_id": seller_id}},
        {"$group": {
            "_id": "$status",
            "amount": {"$sum": "$net_earning"},
            "gross": {"$sum": "$gross_sales"},
            "commission": {"$sum": "$commission"},
            "orders": {"$sum": 1},
        }},
    ]).to_list(10)
    result = {r["_id"]: r for r in agg}
    return {
        "seller_id": seller_id,
        "pending_amount": result.get("pending", {}).get("amount", 0),
        "settled_amount": result.get("settled", {}).get("amount", 0),
        "total_gross": sum(r.get("gross", 0) for r in agg),
        "total_commission": sum(r.get("commission", 0) for r in agg),
        "pending_orders": result.get("pending", {}).get("orders", 0),
        "settled_orders": result.get("settled", {}).get("orders", 0),
    }


@router.post("/seller-settlements", status_code=201)
async def create_seller_settlement(body: SettlementCreate, current_user: dict = Depends(require_admin)):
    db = get_db()
    filt: dict = {"seller_id": body.entity_id, "status": "pending"}
    earnings = await db.seller_earnings.find(filt, {"_id": 0}).to_list(5000)
    if not earnings:
        raise HTTPException(status_code=400, detail="No pending earnings to settle for this seller")

    total = round(sum(e["net_earning"] for e in earnings), 2)
    settlement = {
        "id": new_id(),
        "kind": "seller",
        "entity_id": body.entity_id,
        "total_amount": total,
        "order_count": len(earnings),
        "earnings_ids": [e["id"] for e in earnings],
        "status": "pending",
        "payout_method": body.payout_method,
        "payout_reference": body.payout_reference,
        "notes": body.notes,
        "created_at": utcnow(),
        "paid_at": None,
    }
    await db.seller_settlements.insert_one(settlement)
    settlement.pop("_id", None)
    await db.seller_earnings.update_many(
        {"id": {"$in": settlement["earnings_ids"]}},
        {"$set": {"settlement_id": settlement["id"], "status": "settled"}},
    )
    await log_event(current_user, "seller_settlement.create", "seller_settlement", settlement["id"], {"total": total})
    return settlement


@router.post("/seller-settlements/{sid}/mark-paid")
async def mark_seller_settlement_paid(sid: str, body: SettlementMarkPaid, current_user: dict = Depends(require_admin)):
    db = get_db()
    s = await db.seller_settlements.find_one({"id": sid})
    if not s:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if s.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Settlement already marked as paid")
    updates = {"status": "paid", "paid_at": utcnow(), "updated_at": utcnow()}
    if body.payout_reference:
        updates["payout_reference"] = body.payout_reference
    if body.notes:
        updates["notes"] = body.notes
    await db.seller_settlements.update_one({"id": sid}, {"$set": updates})
    await db.seller_earnings.update_many({"settlement_id": sid}, {"$set": {"status": "paid"}})
    await log_event(current_user, "seller_settlement.mark_paid", "seller_settlement", sid)
    return await db.seller_settlements.find_one({"id": sid}, {"_id": 0})


@router.get("/seller-settlements")
async def list_seller_settlements(
    seller_id: str | None = None,
    status: str | None = None,
    limit: int = Query(200, le=500),
    _: dict = Depends(require_admin),
):
    db = get_db()
    filt: dict = {}
    if seller_id:
        filt["entity_id"] = seller_id
    if status:
        filt["status"] = status
    items = await db.seller_settlements.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"items": items, "total": len(items)}


# =========================================================== RIDER (Point 4)
@router.get("/rider-earnings")
async def list_rider_earnings(
    rider_id: str | None = None,
    status: str | None = None,
    limit: int = Query(200, le=1000),
    _: dict = Depends(require_admin),
):
    db = get_db()
    filt: dict = {}
    if rider_id:
        filt["rider_id"] = rider_id
    if status:
        filt["status"] = status
    items = await db.rider_earnings.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"items": items, "total": len(items)}


@router.get("/riders/{rider_id}/dashboard")
async def rider_dashboard(rider_id: str, _: dict = Depends(require_admin)):
    db = get_db()
    now = utcnow()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = day_start.replace(day=max(1, day_start.day - 6))

    async def sum_since(dt):
        agg = await db.rider_earnings.aggregate([
            {"$match": {"rider_id": rider_id, "created_at": {"$gte": dt}}},
            {"$group": {"_id": None, "amount": {"$sum": "$total_earning"}, "count": {"$sum": 1}, "km": {"$sum": "$distance_km"}}},
        ]).to_list(1)
        return (agg[0] if agg else {"amount": 0, "count": 0, "km": 0})

    today = await sum_since(day_start)
    week = await sum_since(week_start)
    pending_agg = await db.rider_earnings.aggregate([
        {"$match": {"rider_id": rider_id, "status": "pending"}},
        {"$group": {"_id": None, "amount": {"$sum": "$total_earning"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    pending = pending_agg[0] if pending_agg else {"amount": 0, "count": 0}
    return {
        "rider_id": rider_id,
        "today": {"earning": today.get("amount", 0), "deliveries": today.get("count", 0), "km": today.get("km", 0)},
        "week": {"earning": week.get("amount", 0), "deliveries": week.get("count", 0), "km": week.get("km", 0)},
        "pending_payout": {"amount": pending.get("amount", 0), "deliveries": pending.get("count", 0)},
    }


@router.post("/rider-settlements", status_code=201)
async def create_rider_settlement(body: SettlementCreate, current_user: dict = Depends(require_admin)):
    db = get_db()
    earnings = await db.rider_earnings.find({"rider_id": body.entity_id, "status": "pending"}, {"_id": 0}).to_list(5000)
    if not earnings:
        raise HTTPException(status_code=400, detail="No pending earnings to settle for this rider")

    total = round(sum(e["total_earning"] for e in earnings), 2)
    settlement = {
        "id": new_id(),
        "kind": "rider",
        "entity_id": body.entity_id,
        "total_amount": total,
        "delivery_count": len(earnings),
        "earnings_ids": [e["id"] for e in earnings],
        "status": "pending",
        "payout_method": body.payout_method,
        "payout_reference": body.payout_reference,
        "notes": body.notes,
        "created_at": utcnow(),
        "paid_at": None,
    }
    await db.rider_settlements.insert_one(settlement)
    settlement.pop("_id", None)
    await db.rider_earnings.update_many(
        {"id": {"$in": settlement["earnings_ids"]}},
        {"$set": {"settlement_id": settlement["id"], "status": "settled"}},
    )
    await log_event(current_user, "rider_settlement.create", "rider_settlement", settlement["id"], {"total": total})
    return settlement


@router.post("/rider-settlements/{sid}/mark-paid")
async def mark_rider_settlement_paid(sid: str, body: SettlementMarkPaid, current_user: dict = Depends(require_admin)):
    db = get_db()
    s = await db.rider_settlements.find_one({"id": sid})
    if not s:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if s.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Settlement already marked as paid")
    updates = {"status": "paid", "paid_at": utcnow(), "updated_at": utcnow()}
    if body.payout_reference:
        updates["payout_reference"] = body.payout_reference
    if body.notes:
        updates["notes"] = body.notes
    await db.rider_settlements.update_one({"id": sid}, {"$set": updates})
    await db.rider_earnings.update_many({"settlement_id": sid}, {"$set": {"status": "paid"}})
    await log_event(current_user, "rider_settlement.mark_paid", "rider_settlement", sid)
    return await db.rider_settlements.find_one({"id": sid}, {"_id": 0})


@router.get("/rider-settlements")
async def list_rider_settlements(
    rider_id: str | None = None,
    status: str | None = None,
    limit: int = Query(200, le=500),
    _: dict = Depends(require_admin),
):
    db = get_db()
    filt: dict = {}
    if rider_id:
        filt["entity_id"] = rider_id
    if status:
        filt["status"] = status
    items = await db.rider_settlements.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"items": items, "total": len(items)}
