"""Business Rules Engine + Dashboard + Audit + Payments overview."""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query

from audit import log_event
from auth import require_admin, require_roles, get_current_user
from db import get_db
from delivery_engine import validate_delivery_rules
from models import BusinessRulesUpdate, utcnow

router = APIRouter(tags=["admin"])


DEFAULT_RULES = {
    "id": "default",
    "commission_percent": 10.0,
    "delivery_radius_km": 5.0,
    "delivery_charge": 30.0,
    "free_delivery_above": 499.0,
    "min_order_amount": 99.0,
    "verification_radius_meters": 200.0,
    "platform_name": "NEDS STORE",
    "support_mobile": "9999999999",
    "currency": "INR",
    "locale": "en-IN",
    # Enterprise Delivery Charge Engine (Point 1)
    "minimum_delivery_distance_km": 2.0,
    "minimum_delivery_charge": 20.0,
    "per_km_charge": 7.0,
    "maximum_delivery_radius_km": 15.0,
    "free_delivery_threshold": 1000.0,
    "is_free_delivery_enabled": True,
    "weight_charge_rules": [
        {"min_kg": 0.0, "max_kg": 5.0, "charge": 0.0},
        {"min_kg": 5.0, "max_kg": 10.0, "charge": 20.0},
        {"min_kg": 10.0, "max_kg": 20.0, "charge": 50.0},
        {"min_kg": 20.0, "max_kg": None, "charge": 100.0},
    ],
    "default_seller_lat": 12.9716,
    "default_seller_lng": 77.5946,
    # Enterprise Payment Configuration (Point 2)
    "cod_enabled": True,
    "cod_limit": 5000.0,
    "upi_intent_enabled": True,
    "phonepe_enabled": True,
    # Enterprise Rider Payment Model (Point 4)
    "rider_payment_model": "hybrid",
    "rider_base_pay": 20.0,
    "rider_per_km_pay": 5.0,
    "rider_bonus_per_delivery_after": 15,
    "rider_bonus_amount": 50.0,
    "rider_monthly_salary": 15000.0,
    # Enterprise Tax / GST (Point 18)
    "gst_enabled": True,
    "default_gst_percentage": 18.0,
    "company_gst_number": "",
    "company_pan": "",
    "company_address": "",
    "company_state": "",
    "company_state_code": "",
}


@router.get("/business-rules")
async def get_rules(_: dict = Depends(get_current_user)):
    db = get_db()
    rules = await db.business_rules.find_one({"id": "default"}, {"_id": 0})
    if not rules:
        rules = DEFAULT_RULES.copy()
        await db.business_rules.insert_one(rules)
        rules.pop("_id", None)
    return rules


@router.patch("/business-rules")
async def update_rules(body: BusinessRulesUpdate, current_user: dict = Depends(require_admin)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    # Weight slabs come in as list of Pydantic models — normalise to plain dicts
    if "weight_charge_rules" in updates and updates["weight_charge_rules"] is not None:
        updates["weight_charge_rules"] = [
            (s.model_dump() if hasattr(s, "model_dump") else dict(s))
            for s in updates["weight_charge_rules"]
        ]

    # Validate delivery-engine coherence (rules may partially update, so merge first)
    if any(k in updates for k in (
        "minimum_delivery_distance_km", "minimum_delivery_charge", "per_km_charge",
        "maximum_delivery_radius_km", "free_delivery_threshold", "is_free_delivery_enabled",
        "weight_charge_rules",
    )):
        existing = await db.business_rules.find_one({"id": "default"}, {"_id": 0}) or {}
        merged = {**existing, **updates}
        try:
            validate_delivery_rules(merged)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    updates["updated_at"] = utcnow()
    # $setOnInsert may not touch any field that appears in $set (MongoDB path-conflict rule)
    on_insert = {k: v for k, v in DEFAULT_RULES.items() if k not in updates}
    on_insert["id"] = "default"
    await db.business_rules.update_one(
        {"id": "default"},
        {"$set": updates, "$setOnInsert": on_insert},
        upsert=True,
    )
    await log_event(current_user, "rules.update", "business_rules", "default", {"fields": list(updates.keys())})
    rules = await db.business_rules.find_one({"id": "default"}, {"_id": 0})
    return rules


@router.get("/delivery-charge-rules")
async def get_delivery_charge_rules(_: dict = Depends(get_current_user)):
    """Curated slice for customer/seller/rider apps — the delivery-engine
    settings only, so mobile clients can render breakdowns without needing
    the entire business_rules doc."""
    db = get_db()
    r = await db.business_rules.find_one({"id": "default"}, {"_id": 0}) or {}
    return {
        "minimum_delivery_distance_km": r.get("minimum_delivery_distance_km", 2.0),
        "minimum_delivery_charge": r.get("minimum_delivery_charge", 20.0),
        "per_km_charge": r.get("per_km_charge", 7.0),
        "maximum_delivery_radius_km": r.get("maximum_delivery_radius_km", 15.0),
        "free_delivery_threshold": r.get("free_delivery_threshold", 0.0),
        "is_free_delivery_enabled": r.get("is_free_delivery_enabled", True),
        "weight_charge_rules": r.get("weight_charge_rules", []),
        "currency": r.get("currency", "INR"),
    }


# ============ DASHBOARD ============
@router.get("/dashboard/summary")
async def dashboard_summary(_: dict = Depends(require_admin)):
    db = get_db()
    now = utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    total_orders = await db.orders.count_documents({})
    todays_orders = await db.orders.count_documents({"created_at": {"$gte": today_start}})
    active_customers = await db.users.count_documents({"role": "customer", "active": True})
    active_sellers = await db.users.count_documents({"role": "seller", "active": True})
    active_riders = await db.users.count_documents({"role": "rider", "active": True})
    total_products = await db.products.count_documents({"active": True})
    pending_deliveries = await db.deliveries.count_documents({"status": {"$in": ["pending_assignment", "assigned", "at_customer"]}})

    # Revenue aggregation
    revenue_agg = await db.orders.aggregate([
        {"$match": {"status": "delivered"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "commission": {"$sum": "$commission"}}},
    ]).to_list(1)
    total_revenue = revenue_agg[0]["total"] if revenue_agg else 0
    total_commission = revenue_agg[0]["commission"] if revenue_agg else 0

    # 7-day trend
    trend_agg = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": week_start}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "orders": {"$sum": 1},
            "revenue": {"$sum": "$total"},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(30)
    trend = [{"date": r["_id"], "orders": r["orders"], "revenue": r["revenue"]} for r in trend_agg]

    return {
        "kpis": {
            "total_orders": total_orders,
            "todays_orders": todays_orders,
            "total_revenue": total_revenue,
            "total_commission": total_commission,
            "active_customers": active_customers,
            "active_sellers": active_sellers,
            "active_riders": active_riders,
            "total_products": total_products,
            "pending_deliveries": pending_deliveries,
        },
        "trend": trend,
    }


@router.get("/dashboard/live-riders")
async def live_riders(_: dict = Depends(require_admin)):
    db = get_db()
    # Active deliveries with rider locations
    cursor = db.deliveries.find(
        {"status": {"$in": ["assigned", "at_customer"]}, "rider_lat": {"$ne": None}},
        {"_id": 0},
    ).limit(200)
    items = await cursor.to_list(200)
    # Attach rider name
    rider_ids = list({d["rider_id"] for d in items if d.get("rider_id")})
    riders = {}
    if rider_ids:
        async for u in db.users.find({"id": {"$in": rider_ids}}, {"_id": 0, "id": 1, "name": 1, "mobile": 1}):
            riders[u["id"]] = u
    for d in items:
        d["rider"] = riders.get(d.get("rider_id"))
    return {"items": items}


# ============ AUDIT ============
@router.get("/audit-logs")
async def list_audit_logs(
    action: str | None = None,
    entity: str | None = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
    _: dict = Depends(require_admin),
):
    db = get_db()
    filt: dict = {}
    if action:
        filt["action"] = action
    if entity:
        filt["entity"] = entity
    cursor = db.audit_logs.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    total = await db.audit_logs.count_documents(filt)
    return {"items": items, "total": total}


# ============ PAYMENTS OVERVIEW ============
@router.get("/payments")
async def list_payments(status: str | None = None, limit: int = Query(200, le=500), _: dict = Depends(require_admin)):
    db = get_db()
    filt: dict = {}
    if status:
        filt["payment_status"] = status
    cursor = db.orders.find(
        filt,
        {"_id": 0, "id": 1, "customer_id": 1, "total": 1, "payment_method": 1, "payment_status": 1, "status": 1, "created_at": 1, "commission": 1},
    ).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    return {"items": items}
