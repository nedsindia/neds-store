"""Enterprise Service Area & Delivery Zone Management (Point 11),
Reports & Analytics (Point 7 lite), Support Tickets (Point 20 lite),
KYC (Seller/Rider onboarding), Fraud/Risk basics (Point 23 lite).
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import log_event
from auth import get_current_user
from db import get_db
from models import new_id, utcnow
from rbac import require_permission

router = APIRouter(tags=["ops"])


# ============ DELIVERY ZONES (Point 11) ============
class ZoneCreate(BaseModel):
    name: str
    description: str | None = None
    # Simple representation: center + radius. Advanced polygon can be added later.
    center_lat: float
    center_lng: float
    radius_km: float = Field(gt=0)
    extra_delivery_charge: float = 0.0
    active: bool = True


class ZoneUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    center_lat: float | None = None
    center_lng: float | None = None
    radius_km: float | None = None
    extra_delivery_charge: float | None = None
    active: bool | None = None


@router.get("/delivery-zones")
async def list_zones(_: dict = Depends(get_current_user)):
    db = get_db()
    items = await db.delivery_zones.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return {"items": items}


@router.post("/delivery-zones", status_code=201)
async def create_zone(body: ZoneCreate, current_user: dict = Depends(require_permission("rules.update"))):
    db = get_db()
    now = utcnow()
    doc = body.model_dump()
    doc.update({"id": new_id(), "created_at": now, "updated_at": now})
    await db.delivery_zones.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "zone.create", "delivery_zone", doc["id"], {"name": body.name})
    return doc


@router.patch("/delivery-zones/{zone_id}")
async def update_zone(zone_id: str, body: ZoneUpdate, current_user: dict = Depends(require_permission("rules.update"))):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    updates["updated_at"] = utcnow()
    r = await db.delivery_zones.update_one({"id": zone_id}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Zone not found")
    await log_event(current_user, "zone.update", "delivery_zone", zone_id, {"fields": list(updates.keys())})
    return await db.delivery_zones.find_one({"id": zone_id}, {"_id": 0})


@router.delete("/delivery-zones/{zone_id}")
async def delete_zone(zone_id: str, current_user: dict = Depends(require_permission("rules.update"))):
    db = get_db()
    r = await db.delivery_zones.delete_one({"id": zone_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone not found")
    await log_event(current_user, "zone.delete", "delivery_zone", zone_id)
    return {"ok": True}


# ============ KYC / VERIFICATION (Seller & Rider) ============
class KYCUpdate(BaseModel):
    kyc_status: str  # pending | approved | rejected
    kyc_note: str | None = None
    aadhaar_number: str | None = None
    pan_number: str | None = None
    gst_number: str | None = None
    driving_license: str | None = None
    vehicle_number: str | None = None
    vehicle_type: str | None = None


@router.get("/kyc/pending")
async def list_pending_kyc(role: str | None = None, _: dict = Depends(require_permission("users.view"))):
    """List seller/rider users awaiting KYC approval."""
    db = get_db()
    filt: dict = {"role": {"$in": ["seller", "rider"]}, "kyc_status": {"$in": ["pending", None]}}
    if role in ("seller", "rider"):
        filt["role"] = role
    else:
        filt["role"] = {"$in": ["seller", "rider"]}
    items = await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(200).to_list(200)
    return {"items": items}


@router.patch("/users/{user_id}/kyc")
async def update_kyc(user_id: str, body: KYCUpdate, current_user: dict = Depends(require_permission("users.update"))):
    if body.kyc_status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid kyc_status")
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    updates["kyc_reviewed_at"] = utcnow()
    updates["kyc_reviewed_by"] = current_user["id"]
    updates["updated_at"] = utcnow()
    # On approve: mark active. On reject: leave active status untouched.
    if body.kyc_status == "approved":
        updates["active"] = True
    await db.users.update_one({"id": user_id}, {"$set": updates})
    await log_event(current_user, "kyc.update", "user", user_id, {"status": body.kyc_status})
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


# ============ SUPPORT TICKETS (Point 20 lite) ============
class TicketCreate(BaseModel):
    subject: str
    category: str
    priority: str = "medium"  # low | medium | high | critical
    description: str
    order_id: str | None = None


class TicketReply(BaseModel):
    message: str
    internal: bool = False


class TicketStatus(BaseModel):
    status: str  # open | in_progress | waiting_customer | resolved | closed
    note: str | None = None


TICKET_STATUSES = ["open", "in_progress", "waiting_customer", "resolved", "closed"]


@router.post("/tickets", status_code=201)
async def create_ticket(body: TicketCreate, current_user: dict = Depends(get_current_user)):
    if body.priority not in ("low", "medium", "high", "critical"):
        raise HTTPException(status_code=400, detail="Invalid priority")
    db = get_db()
    now = utcnow()
    doc = {
        "id": new_id(),
        "subject": body.subject,
        "category": body.category,
        "priority": body.priority,
        "description": body.description,
        "order_id": body.order_id,
        "customer_id": current_user["id"],
        "customer_name": current_user.get("name"),
        "customer_role": current_user.get("role"),
        "status": "open",
        "assigned_to": None,
        "messages": [{
            "id": new_id(),
            "message": body.description,
            "internal": False,
            "sender_id": current_user["id"],
            "sender_name": current_user.get("name"),
            "sender_role": current_user.get("role"),
            "created_at": now,
        }],
        "status_history": [{"status": "open", "at": now, "by": current_user["id"]}],
        "created_at": now,
        "updated_at": now,
    }
    await db.support_tickets.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "ticket.create", "ticket", doc["id"], {"category": body.category})
    return doc


@router.get("/tickets")
async def list_tickets(
    status: str | None = None,
    priority: str | None = None,
    limit: int = Query(200, le=500),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    filt: dict = {}
    if status: filt["status"] = status
    if priority: filt["priority"] = priority
    if current_user.get("role") in ("customer", "seller", "rider"):
        filt["customer_id"] = current_user["id"]
    cursor = db.support_tickets.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    # Hide internal messages for non-admin
    if current_user.get("role") not in ("super_admin", "manager", "staff_admin", "staff"):
        for t in items:
            t["messages"] = [m for m in t.get("messages", []) if not m.get("internal")]
    return {"items": items, "total": await db.support_tickets.count_documents(filt)}


@router.post("/tickets/{ticket_id}/reply")
async def reply_ticket(ticket_id: str, body: TicketReply, current_user: dict = Depends(get_current_user)):
    db = get_db()
    ticket = await db.support_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    is_admin = current_user.get("role") in ("super_admin", "manager", "staff_admin", "staff")
    if not is_admin and ticket["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.internal and not is_admin:
        raise HTTPException(status_code=403, detail="Only staff can add internal notes")
    msg = {
        "id": new_id(),
        "message": body.message,
        "internal": body.internal and is_admin,
        "sender_id": current_user["id"],
        "sender_name": current_user.get("name"),
        "sender_role": current_user.get("role"),
        "created_at": utcnow(),
    }
    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$push": {"messages": msg}, "$set": {"updated_at": utcnow()}},
    )
    return {"ok": True, "message": msg}


@router.patch("/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, body: TicketStatus, current_user: dict = Depends(get_current_user)):
    if body.status not in TICKET_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {TICKET_STATUSES}")
    is_admin = current_user.get("role") in ("super_admin", "manager", "staff_admin", "staff")
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only staff can update ticket status")
    db = get_db()
    ticket = await db.support_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    now = utcnow()
    entry = {"status": body.status, "at": now, "by": current_user["id"], "note": body.note}
    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": body.status, "updated_at": now}, "$push": {"status_history": entry}},
    )
    await log_event(current_user, "ticket.status", "ticket", ticket_id, {"status": body.status})
    return await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})


# ============ REPORTS & ANALYTICS (Point 7 lite) — real data only ============
@router.get("/reports/overview")
async def reports_overview(
    days: int = Query(30, ge=1, le=365),
    _: dict = Depends(require_permission("reports.view")),
):
    db = get_db()
    now = utcnow()
    since = now - timedelta(days=days)

    # Orders
    total_orders = await db.orders.count_documents({"created_at": {"$gte": since}})
    delivered = await db.orders.count_documents({"status": "delivered", "created_at": {"$gte": since}})
    cancelled = await db.orders.count_documents({"status": "cancelled", "created_at": {"$gte": since}})

    revenue_agg = await db.orders.aggregate([
        {"$match": {"status": "delivered", "created_at": {"$gte": since}}},
        {"$group": {"_id": None, "gross": {"$sum": "$total"}, "commission": {"$sum": "$commission"}}},
    ]).to_list(1)
    gross = round(revenue_agg[0]["gross"], 2) if revenue_agg else 0
    commission = round(revenue_agg[0]["commission"], 2) if revenue_agg else 0

    # Daily trend
    trend = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "orders": {"$sum": 1},
            "revenue": {"$sum": "$total"},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(400)
    trend_rows = [{"date": r["_id"], "orders": r["orders"], "revenue": round(r["revenue"], 2)} for r in trend]

    # People
    customers = await db.users.count_documents({"role": "customer"})
    sellers = await db.users.count_documents({"role": "seller"})
    riders = await db.users.count_documents({"role": "rider"})
    active_sellers = await db.users.count_documents({"role": "seller", "active": True})
    active_riders = await db.users.count_documents({"role": "rider", "active": True})

    # Payments
    paid = await db.orders.count_documents({"payment_status": "paid", "created_at": {"$gte": since}})
    pending = await db.orders.count_documents({"payment_status": "pending", "created_at": {"$gte": since}})
    refunded = await db.orders.count_documents({"payment_status": "refunded", "created_at": {"$gte": since}})

    # Settlements
    seller_pending = await db.seller_earnings.count_documents({"status": "pending"})
    seller_paid = await db.seller_earnings.count_documents({"status": "settled"})
    rider_pending = await db.rider_earnings.count_documents({"status": "pending"})
    rider_paid = await db.rider_earnings.count_documents({"status": "settled"})

    # Returns
    returns_total = await db.return_requests.count_documents({})
    returns_pending = await db.return_requests.count_documents({"status": {"$in": ["requested", "approved", "pickup_scheduled", "picked_up"]}})

    # Inventory
    total_products = await db.products.count_documents({})
    out_of_stock = await db.products.count_documents({"stock": 0})

    # Top products by revenue
    top_products = await db.orders.aggregate([
        {"$match": {"status": "delivered", "created_at": {"$gte": since}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "name": {"$first": "$items.name"},
            "revenue": {"$sum": {"$multiply": ["$items.price", "$items.qty"]}},
            "qty": {"$sum": "$items.qty"},
        }},
        {"$sort": {"revenue": -1}},
        {"$limit": 10},
    ]).to_list(10)

    return {
        "period_days": days,
        "orders": {"total": total_orders, "delivered": delivered, "cancelled": cancelled},
        "revenue": {"gross": gross, "commission": commission, "net_platform": commission},
        "trend": trend_rows,
        "people": {
            "customers": customers, "sellers": sellers, "riders": riders,
            "active_sellers": active_sellers, "active_riders": active_riders,
        },
        "payments": {"paid": paid, "pending": pending, "refunded": refunded},
        "settlements": {
            "seller_pending": seller_pending, "seller_paid": seller_paid,
            "rider_pending": rider_pending, "rider_paid": rider_paid,
        },
        "returns": {"total": returns_total, "pending": returns_pending},
        "inventory": {"total_products": total_products, "out_of_stock": out_of_stock},
        "top_products": [
            {"product_id": r["_id"], "name": r["name"], "revenue": round(r["revenue"], 2), "qty": r["qty"]}
            for r in top_products
        ],
    }


# ============ FRAUD / RISK (Point 23 lite) ============
@router.get("/fraud/alerts")
async def fraud_alerts(_: dict = Depends(require_permission("audit.view"))):
    """Simple heuristic risk detection over existing data. Read-only, no auto-blocking."""
    db = get_db()
    since = utcnow() - timedelta(days=30)

    # High cancellation rate customers
    cancels_by_cust = await db.orders.aggregate([
        {"$match": {"status": "cancelled", "created_at": {"$gte": since}}},
        {"$group": {"_id": "$customer_id", "cancelled": {"$sum": 1}}},
        {"$match": {"cancelled": {"$gte": 3}}},
        {"$sort": {"cancelled": -1}},
        {"$limit": 20},
    ]).to_list(20)

    # Repeated payment failures
    payment_fail = await db.payment_transactions.aggregate([
        {"$match": {"status": {"$in": ["FAILED", "failed"]}, "created_at": {"$gte": since}}},
        {"$group": {"_id": "$customer_id", "failures": {"$sum": 1}}},
        {"$match": {"failures": {"$gte": 3}}},
        {"$sort": {"failures": -1}},
        {"$limit": 20},
    ]).to_list(20)

    # Excessive returns
    return_fails = await db.return_requests.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$customer_id", "returns": {"$sum": 1}}},
        {"$match": {"returns": {"$gte": 3}}},
        {"$sort": {"returns": -1}},
        {"$limit": 20},
    ]).to_list(20)

    alerts = []
    for r in cancels_by_cust:
        alerts.append({"customer_id": r["_id"], "type": "excessive_cancellations", "value": r["cancelled"], "risk": "medium"})
    for r in payment_fail:
        alerts.append({"customer_id": r["_id"], "type": "repeated_payment_failures", "value": r["failures"], "risk": "high"})
    for r in return_fails:
        alerts.append({"customer_id": r["_id"], "type": "excessive_returns", "value": r["returns"], "risk": "medium"})

    return {"alerts": alerts, "total": len(alerts)}
