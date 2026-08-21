"""Inventory & Stock Management (Point 17) + Stock Movement Logs (Point 22 lite).

Every stock change is logged to `stock_movements` with a reason and the actor.
Movements happen automatically on:
  - Product creation (initial stock)
  - Order placed → reserve stock (soft-reserve)
  - Order cancelled → release reservation
  - Delivery verified → deduct from stock
  - Return refunded → optionally add back (admin decision at return-status update)
And manually via admin `POST /inventory/{product_id}/adjust`.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import log_event
from auth import get_current_user
from db import get_db
from models import new_id, utcnow
from rbac import require_permission

router = APIRouter(tags=["inventory"])


MOVEMENT_TYPES = [
    "initial", "purchase", "order_reserved", "order_delivered", "order_cancelled",
    "return_received", "manual_adjustment", "damaged", "expired", "correction",
]


class StockAdjustment(BaseModel):
    delta: int  # positive to add, negative to remove
    reason: str
    movement_type: str = "manual_adjustment"
    note: str | None = None


class StockUpdate(BaseModel):
    stock: int = Field(ge=0)
    reason: str
    note: str | None = None


class ThresholdUpdate(BaseModel):
    low_stock_threshold: int = Field(ge=0)


async def log_stock_movement(
    db, actor: dict | None, product_id: str, movement_type: str,
    previous: int, updated: int, reason: str | None = None,
    order_id: str | None = None, extra: dict | None = None,
):
    """Insert a stock_movement row. `previous` and `updated` are the stock BEFORE and AFTER."""
    doc = {
        "id": new_id(),
        "product_id": product_id,
        "movement_type": movement_type,
        "previous_stock": previous,
        "updated_stock": updated,
        "quantity_changed": updated - previous,
        "reason": reason,
        "order_id": order_id,
        "actor_id": (actor or {}).get("id"),
        "actor_role": (actor or {}).get("role"),
        "extra": extra or {},
        "created_at": utcnow(),
    }
    await db.stock_movements.insert_one(doc)
    return doc


# ============ INVENTORY LISTINGS ============
@router.get("/inventory")
async def list_inventory(
    q: str | None = None,
    category_id: str | None = None,
    seller_id: str | None = None,
    stock_filter: str | None = None,  # low | out | in_stock
    limit: int = Query(200, le=500),
    _: dict = Depends(require_permission("inventory.view")),
):
    db = get_db()
    filt: dict = {}
    if q: filt["name"] = {"$regex": q, "$options": "i"}
    if category_id: filt["category_id"] = category_id
    if seller_id: filt["seller_id"] = seller_id

    if stock_filter == "out":
        filt["stock"] = 0
    elif stock_filter == "in_stock":
        filt["stock"] = {"$gt": 0}
    # `low` needs comparison to per-product threshold — filter post-query

    cursor = db.products.find(filt, {"_id": 0}).sort("stock", 1).limit(limit)
    items = await cursor.to_list(limit)

    # Enrich with computed status
    for p in items:
        stock = int(p.get("stock", 0) or 0)
        threshold = int(p.get("low_stock_threshold", 5) or 5)
        if stock == 0:
            p["stock_status"] = "out_of_stock"
        elif stock <= threshold:
            p["stock_status"] = "low_stock"
        else:
            p["stock_status"] = "in_stock"

    if stock_filter == "low":
        items = [p for p in items if p["stock_status"] == "low_stock"]

    return {"items": items, "total": len(items)}


@router.get("/inventory/summary")
async def inventory_summary(_: dict = Depends(require_permission("inventory.view"))):
    db = get_db()
    total_products = await db.products.count_documents({})
    active_products = await db.products.count_documents({"active": True})
    out_of_stock = await db.products.count_documents({"stock": 0})

    # Low stock: use aggregation to compare stock ≤ threshold
    low_agg = await db.products.aggregate([
        {"$addFields": {"_threshold": {"$ifNull": ["$low_stock_threshold", 5]}}},
        {"$match": {"$expr": {"$and": [{"$gt": ["$stock", 0]}, {"$lte": ["$stock", "$_threshold"]}]}}},
        {"$count": "n"},
    ]).to_list(1)
    low_stock = low_agg[0]["n"] if low_agg else 0

    stock_value_agg = await db.products.aggregate([
        {"$group": {"_id": None, "total_value": {"$sum": {"$multiply": ["$stock", "$price"]}}}},
    ]).to_list(1)
    total_stock_value = round(stock_value_agg[0]["total_value"], 2) if stock_value_agg else 0

    # Recent movements (last 24h)
    since = utcnow() - timedelta(hours=24)
    recent_movements = await db.stock_movements.count_documents({"created_at": {"$gte": since}})

    return {
        "total_products": total_products,
        "active_products": active_products,
        "out_of_stock": out_of_stock,
        "low_stock": low_stock,
        "total_stock_value": total_stock_value,
        "recent_movements_24h": recent_movements,
    }


@router.post("/inventory/{product_id}/adjust")
async def adjust_stock(
    product_id: str,
    body: StockAdjustment,
    current_user: dict = Depends(require_permission("inventory.adjust")),
):
    if body.movement_type not in MOVEMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Movement type must be one of: {MOVEMENT_TYPES}")
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required for every stock adjustment")

    db = get_db()
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    previous = int(product.get("stock", 0) or 0)
    new_stock = previous + body.delta
    if new_stock < 0:
        raise HTTPException(status_code=400, detail=f"Adjustment would result in negative stock ({new_stock}). Current stock: {previous}.")

    now = utcnow()
    await db.products.update_one({"id": product_id}, {"$set": {"stock": new_stock, "updated_at": now}})
    await log_stock_movement(
        db, current_user, product_id, body.movement_type, previous, new_stock,
        reason=body.reason, extra={"note": body.note},
    )
    await log_event(current_user, "inventory.adjust", "product", product_id, {"delta": body.delta, "reason": body.reason})
    return {"ok": True, "previous_stock": previous, "updated_stock": new_stock}


@router.post("/inventory/{product_id}/set")
async def set_stock(
    product_id: str,
    body: StockUpdate,
    current_user: dict = Depends(require_permission("inventory.adjust")),
):
    """Set absolute stock (useful for reconciliation)."""
    db = get_db()
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    previous = int(product.get("stock", 0) or 0)
    now = utcnow()
    await db.products.update_one({"id": product_id}, {"$set": {"stock": body.stock, "updated_at": now}})
    await log_stock_movement(
        db, current_user, product_id, "correction", previous, body.stock,
        reason=body.reason, extra={"note": body.note},
    )
    await log_event(current_user, "inventory.set", "product", product_id, {"from": previous, "to": body.stock})
    return {"ok": True, "previous_stock": previous, "updated_stock": body.stock}


@router.patch("/inventory/{product_id}/threshold")
async def update_threshold(
    product_id: str,
    body: ThresholdUpdate,
    current_user: dict = Depends(require_permission("inventory.adjust")),
):
    db = get_db()
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": {"low_stock_threshold": body.low_stock_threshold, "updated_at": utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    await log_event(current_user, "inventory.threshold", "product", product_id, {"threshold": body.low_stock_threshold})
    return {"ok": True, "low_stock_threshold": body.low_stock_threshold}


# ============ MOVEMENT LOGS (Point 22 lite) ============
@router.get("/inventory/movements")
async def list_movements(
    product_id: str | None = None,
    movement_type: str | None = None,
    limit: int = Query(200, le=500),
    _: dict = Depends(require_permission("inventory.movements.view", "inventory.view")),
):
    db = get_db()
    filt: dict = {}
    if product_id: filt["product_id"] = product_id
    if movement_type: filt["movement_type"] = movement_type
    cursor = db.stock_movements.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)

    # Enrich with product name
    prod_ids = list({m["product_id"] for m in items})
    prods: dict = {}
    async for p in db.products.find({"id": {"$in": prod_ids}}, {"_id": 0, "id": 1, "name": 1}):
        prods[p["id"]] = p.get("name")
    for m in items:
        m["product_name"] = prods.get(m["product_id"], "—")

    return {"items": items, "total": await db.stock_movements.count_documents(filt)}
