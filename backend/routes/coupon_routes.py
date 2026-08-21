"""Enterprise Coupon / Offer / Promotion Engine (Point 21)."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import log_event
from auth import get_current_user
from db import get_db
from models import new_id, utcnow
from rbac import require_permission

router = APIRouter(tags=["coupons"])

DISCOUNT_TYPES = ["flat", "percentage", "free_delivery"]


class CouponCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    discount_type: str  # flat | percentage | free_delivery
    discount_value: float = 0.0
    min_order_value: float = 0.0
    max_discount: float | None = None  # cap for percentage
    max_uses: int | None = None  # total across all customers
    max_uses_per_customer: int = 1
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    applicable_category_ids: list[str] = []
    applicable_product_ids: list[str] = []
    active: bool = True


class CouponUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    discount_type: str | None = None
    discount_value: float | None = None
    min_order_value: float | None = None
    max_discount: float | None = None
    max_uses: int | None = None
    max_uses_per_customer: int | None = None
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    applicable_category_ids: list[str] | None = None
    applicable_product_ids: list[str] | None = None
    active: bool | None = None


class CouponValidate(BaseModel):
    code: str
    order_subtotal: float
    delivery_charge: float = 0.0
    customer_id: str | None = None
    category_ids: list[str] = []
    product_ids: list[str] = []


def _normalize_code(s: str) -> str:
    return s.strip().upper().replace(" ", "")


def _compute_discount(coupon: dict, subtotal: float, delivery: float) -> dict:
    dtype = coupon.get("discount_type")
    val = float(coupon.get("discount_value", 0))
    if dtype == "flat":
        d = min(val, subtotal)
        return {"discount": round(d, 2), "delivery_discount": 0.0}
    if dtype == "percentage":
        d = subtotal * (val / 100)
        cap = coupon.get("max_discount")
        if cap is not None and cap > 0:
            d = min(d, float(cap))
        return {"discount": round(d, 2), "delivery_discount": 0.0}
    if dtype == "free_delivery":
        return {"discount": 0.0, "delivery_discount": round(delivery, 2)}
    return {"discount": 0.0, "delivery_discount": 0.0}


@router.get("/coupons")
async def list_coupons(
    active: bool | None = None,
    limit: int = Query(200, le=500),
    _: dict = Depends(require_permission("coupons.view")),
):
    db = get_db()
    filt: dict = {}
    if active is not None:
        filt["active"] = active
    cursor = db.coupons.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)

    # Enrich with usage counts
    ids = [c["id"] for c in items]
    usage: dict[str, int] = {}
    if ids:
        async for row in db.coupon_usage.aggregate([
            {"$match": {"coupon_id": {"$in": ids}}},
            {"$group": {"_id": "$coupon_id", "count": {"$sum": 1}}},
        ]):
            usage[row["_id"]] = row["count"]
    for c in items:
        c["usage_count"] = usage.get(c["id"], 0)
    return {"items": items, "total": await db.coupons.count_documents(filt)}


@router.get("/coupons/summary")
async def coupons_summary(_: dict = Depends(require_permission("coupons.view"))):
    db = get_db()
    active = await db.coupons.count_documents({"active": True})
    expired_agg = await db.coupons.count_documents({"expires_at": {"$lt": utcnow()}})
    total_usage = await db.coupon_usage.count_documents({})
    disc_agg = await db.coupon_usage.aggregate([
        {"$group": {"_id": None, "d": {"$sum": "$discount"}}}
    ]).to_list(1)
    total_discount = round(disc_agg[0]["d"], 2) if disc_agg else 0
    return {
        "active_coupons": active,
        "expired_coupons": expired_agg,
        "total_uses": total_usage,
        "total_discount_given": total_discount,
    }


@router.post("/coupons", status_code=201)
async def create_coupon(body: CouponCreate, current_user: dict = Depends(require_permission("coupons.manage"))):
    if body.discount_type not in DISCOUNT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid discount type. Allowed: {DISCOUNT_TYPES}")
    if body.discount_type == "percentage" and (body.discount_value <= 0 or body.discount_value > 100):
        raise HTTPException(status_code=400, detail="Percentage discount must be between 0 and 100")
    if body.discount_type == "flat" and body.discount_value <= 0:
        raise HTTPException(status_code=400, detail="Flat discount must be > 0")

    db = get_db()
    code = _normalize_code(body.code)
    if not code:
        raise HTTPException(status_code=400, detail="Coupon code required")
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Coupon code already exists")

    now = utcnow()
    doc = body.model_dump()
    doc.update({
        "id": new_id(),
        "code": code,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"],
    })
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "coupon.create", "coupon", doc["id"], {"code": code})
    return doc


@router.patch("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, body: CouponUpdate, current_user: dict = Depends(require_permission("coupons.manage"))):
    db = get_db()
    coupon = await db.coupons.find_one({"id": coupon_id})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "discount_type" in updates and updates["discount_type"] not in DISCOUNT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid discount type")
    updates["updated_at"] = utcnow()
    await db.coupons.update_one({"id": coupon_id}, {"$set": updates})
    await log_event(current_user, "coupon.update", "coupon", coupon_id, {"fields": list(updates.keys())})
    return await db.coupons.find_one({"id": coupon_id}, {"_id": 0})


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, current_user: dict = Depends(require_permission("coupons.manage"))):
    db = get_db()
    coupon = await db.coupons.find_one({"id": coupon_id})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    await db.coupons.delete_one({"id": coupon_id})
    await log_event(current_user, "coupon.delete", "coupon", coupon_id, {"code": coupon.get("code")})
    return {"ok": True}


@router.post("/coupons/validate")
async def validate_coupon(body: CouponValidate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    code = _normalize_code(body.code)
    coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    if not coupon.get("active", True):
        raise HTTPException(status_code=400, detail="This coupon is not active")

    now = utcnow()
    starts = coupon.get("starts_at")
    expires = coupon.get("expires_at")
    if starts and now < starts:
        raise HTTPException(status_code=400, detail="Coupon is not yet valid")
    if expires and now > expires:
        raise HTTPException(status_code=400, detail="Coupon has expired")

    min_val = float(coupon.get("min_order_value") or 0)
    if body.order_subtotal < min_val:
        raise HTTPException(status_code=400, detail=f"Minimum order value ₹{min_val:.0f} required for this coupon")

    # Usage limits
    max_uses = coupon.get("max_uses")
    if max_uses is not None:
        total_uses = await db.coupon_usage.count_documents({"coupon_id": coupon["id"]})
        if total_uses >= max_uses:
            raise HTTPException(status_code=400, detail="Coupon usage limit reached")

    customer_id = body.customer_id or current_user["id"]
    max_per = int(coupon.get("max_uses_per_customer") or 1)
    if max_per > 0:
        used = await db.coupon_usage.count_documents({"coupon_id": coupon["id"], "customer_id": customer_id})
        if used >= max_per:
            raise HTTPException(status_code=400, detail="You have already used this coupon the maximum times allowed")

    # Applicable products/categories
    if coupon.get("applicable_product_ids"):
        if not set(body.product_ids or []) & set(coupon["applicable_product_ids"]):
            raise HTTPException(status_code=400, detail="Coupon not applicable to items in cart")
    if coupon.get("applicable_category_ids"):
        if not set(body.category_ids or []) & set(coupon["applicable_category_ids"]):
            raise HTTPException(status_code=400, detail="Coupon not applicable to categories in cart")

    d = _compute_discount(coupon, body.order_subtotal, body.delivery_charge)
    return {
        "valid": True,
        "coupon_id": coupon["id"],
        "code": coupon["code"],
        "discount_type": coupon["discount_type"],
        "discount": d["discount"],
        "delivery_discount": d["delivery_discount"],
        "final_payable": round(body.order_subtotal - d["discount"] + max(0, body.delivery_charge - d["delivery_discount"]), 2),
    }


async def record_coupon_usage(db, coupon_id: str, customer_id: str, order_id: str, discount: float):
    """Called by order-create when a coupon is applied. Never fails order flow."""
    try:
        await db.coupon_usage.insert_one({
            "id": new_id(),
            "coupon_id": coupon_id,
            "customer_id": customer_id,
            "order_id": order_id,
            "discount": round(discount, 2),
            "created_at": utcnow(),
        })
    except Exception:
        pass
