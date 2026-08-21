"""Public routes (no auth required) for the customer-facing website.
All heavy business logic lives in the existing modules — this layer only exposes
read-only + limited-write endpoints suitable for the public site.
"""
import math
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from auth import hash_password
from db import get_db
from models import new_id, utcnow

router = APIRouter(tags=["public"], prefix="/public")


def _sanitize_product(p: dict) -> dict:
    """Remove internal fields (commission, seller cost, etc.) before returning to public."""
    for k in ("commission_percentage", "commission_amount", "seller_cost"):
        p.pop(k, None)
    return p


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


@router.get("/home")
async def public_home():
    """Bundle of everything the home page needs in one call."""
    db = get_db()
    categories = await db.categories.find({"active": True}, {"_id": 0}).sort("name", 1).limit(20).to_list(20)
    if not categories:
        categories = await db.categories.find({}, {"_id": 0}).sort("name", 1).limit(20).to_list(20)

    # Featured = most in stock and active
    featured = await db.products.find(
        {"active": True, "stock": {"$gt": 0}},
        {"_id": 0}
    ).sort("stock", -1).limit(8).to_list(8)
    featured = [_sanitize_product(p) for p in featured]

    # New arrivals = last created
    newest = await db.products.find(
        {"active": True, "stock": {"$gt": 0}},
        {"_id": 0}
    ).sort("created_at", -1).limit(8).to_list(8)
    newest = [_sanitize_product(p) for p in newest]

    # Deals = products with mrp > price
    deals = await db.products.aggregate([
        {"$match": {"active": True, "stock": {"$gt": 0}, "$expr": {"$gt": ["$mrp", "$price"]}}},
        {"$addFields": {"discount_pct": {"$multiply": [{"$divide": [{"$subtract": ["$mrp", "$price"]}, "$mrp"]}, 100]}}},
        {"$sort": {"discount_pct": -1}},
        {"$limit": 8},
        {"$project": {"_id": 0}},
    ]).to_list(8)
    deals = [_sanitize_product(p) for p in deals]

    rules = await db.business_rules.find_one({"id": "default"}, {"_id": 0}) or {}

    return {
        "categories": categories,
        "featured": featured,
        "newest": newest,
        "deals": deals,
        "platform_name": rules.get("platform_name") or "NEDS STORE",
        "support_mobile": rules.get("support_mobile") or "",
        "min_order_amount": rules.get("min_order_amount") or 0,
        "free_delivery_threshold": rules.get("free_delivery_threshold"),
    }


@router.get("/categories")
async def public_categories():
    db = get_db()
    items = await db.categories.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(100)
    if not items:
        items = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return {"items": items}


@router.get("/products")
async def public_products(
    q: str | None = None,
    category_id: str | None = None,
    seller_id: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    in_stock: bool = True,
    sort: str = "popular",  # popular | price_asc | price_desc | newest
    limit: int = Query(48, le=100),
    skip: int = 0,
):
    db = get_db()
    filt: dict = {"active": True}
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    if category_id: filt["category_id"] = category_id
    if seller_id: filt["seller_id"] = seller_id
    if in_stock: filt["stock"] = {"$gt": 0}
    if min_price is not None or max_price is not None:
        pf: dict = {}
        if min_price is not None: pf["$gte"] = min_price
        if max_price is not None: pf["$lte"] = max_price
        filt["price"] = pf

    sort_spec = [("stock", -1)]
    if sort == "price_asc": sort_spec = [("price", 1)]
    elif sort == "price_desc": sort_spec = [("price", -1)]
    elif sort == "newest": sort_spec = [("created_at", -1)]

    cursor = db.products.find(filt, {"_id": 0}).sort(sort_spec).skip(skip).limit(limit)
    items = [_sanitize_product(p) for p in await cursor.to_list(limit)]
    total = await db.products.count_documents(filt)
    return {"items": items, "total": total}


@router.get("/product/{product_id}")
async def public_product(product_id: str):
    db = get_db()
    p = await db.products.find_one({"id": product_id, "active": True}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    p = _sanitize_product(p)

    seller = None
    if p.get("seller_id"):
        seller_doc = await db.users.find_one(
            {"id": p["seller_id"], "role": "seller"},
            {"_id": 0, "id": 1, "name": 1, "mobile": 1, "active": 1, "kyc_status": 1},
        )
        if seller_doc:
            seller = {"id": seller_doc["id"], "name": seller_doc.get("name"), "verified": seller_doc.get("kyc_status") == "approved"}

    category = None
    if p.get("category_id"):
        cat = await db.categories.find_one({"id": p["category_id"]}, {"_id": 0, "id": 1, "name": 1})
        if cat: category = cat

    # Related — same category, exclude self
    related = []
    if p.get("category_id"):
        r_cursor = db.products.find(
            {"category_id": p["category_id"], "active": True, "stock": {"$gt": 0}, "id": {"$ne": product_id}},
            {"_id": 0},
        ).limit(8)
        related = [_sanitize_product(rp) for rp in await r_cursor.to_list(8)]

    return {"product": p, "seller": seller, "category": category, "related": related}


class LocationCheck(BaseModel):
    lat: float
    lng: float


@router.post("/check-location")
async def check_location(body: LocationCheck):
    """Return whether the given lat/lng is inside any active delivery zone (Point 11)."""
    db = get_db()
    zones = await db.delivery_zones.find({"active": True}, {"_id": 0}).to_list(200)
    if not zones:
        return {
            "serviceable": False,
            "reason": "no_zones_configured",
            "message": "Coming soon in your area",
        }
    matched = None
    for z in zones:
        dist = _haversine_km(body.lat, body.lng, z["center_lat"], z["center_lng"])
        if dist <= float(z.get("radius_km", 0)):
            matched = {**z, "distance_km": round(dist, 2)}
            break
    if not matched:
        return {
            "serviceable": False,
            "reason": "outside_zone",
            "message": "Sorry, NEDS STORE is currently not available in your area.",
        }
    return {
        "serviceable": True,
        "zone": {
            "id": matched["id"],
            "name": matched["name"],
            "extra_delivery_charge": matched.get("extra_delivery_charge", 0),
        },
    }


class CustomerRegister(BaseModel):
    name: str
    mobile: str
    password: str
    email: str | None = None


@router.post("/register", status_code=201)
async def customer_register(body: CustomerRegister):
    if not body.mobile.isdigit() or len(body.mobile) != 10:
        raise HTTPException(status_code=400, detail="Mobile must be 10 digits")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    db = get_db()
    if await db.users.find_one({"mobile": body.mobile}):
        raise HTTPException(status_code=400, detail="This mobile number is already registered. Please login.")
    now = utcnow()
    doc = {
        "id": new_id(),
        "name": body.name.strip(),
        "mobile": body.mobile,
        "email": (body.email or "").strip() or None,
        "password_hash": hash_password(body.password),
        "role": "customer",
        "active": True,
        "addresses": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(doc)
    from auth import create_access_token
    token = create_access_token(doc["id"], doc["mobile"], doc["role"])
    doc.pop("_id", None); doc.pop("password_hash", None)
    return {"access_token": token, "token_type": "bearer", "user": doc}


@router.get("/service-config")
async def public_service_config():
    """Small config bundle used by the frontend for feature flags."""
    db = get_db()
    accounts = await db.payment_accounts.find(
        {"active": True},
        {"_id": 0, "type": 1, "upi_id": 1, "holder_name": 1, "label": 1, "is_primary": 1},
    ).to_list(20)
    # only expose UPI ID + labels — never expose bank account numbers on public site
    safe_accounts = []
    for a in accounts:
        if a.get("type") == "upi" and a.get("upi_id"):
            safe_accounts.append({
                "type": "upi",
                "upi_id": a["upi_id"],
                "holder_name": a.get("holder_name"),
                "label": a.get("label"),
                "is_primary": a.get("is_primary", False),
            })
    rules = await db.business_rules.find_one({"id": "default"}, {"_id": 0}) or {}
    return {
        "cod_enabled": rules.get("cod_enabled", True),
        "cod_max_amount": rules.get("cod_max_amount"),
        "upi_intent_enabled": rules.get("upi_intent_enabled", True),
        "phonepe_enabled": rules.get("phonepe_enabled", False),
        "upi_accounts": safe_accounts,
        "min_order_amount": rules.get("min_order_amount") or 0,
        "platform_name": rules.get("platform_name") or "NEDS STORE",
        "support_mobile": rules.get("support_mobile") or "",
    }
