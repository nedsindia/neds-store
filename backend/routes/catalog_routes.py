"""Category and Product routes.

Commission model (added in the Category-Based Dynamic Commission Module):
- Each Category owns a [min_commission, max_commission] range.
- Every Product carries its own commission_percentage, which MUST fall within
  its category's current range at write time.
- Products whose commission is outside the category's *current* range are not
  automatically corrected — they surface as "Out of Range" in the admin panel
  so an admin or seller can review and update them.
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from audit import log_event
from auth import ROLE_SELLER, get_current_user, require_admin, require_roles
from db import get_db
from models import CategoryCreate, CategoryUpdate, ProductCreate, ProductUpdate, new_id, utcnow

router = APIRouter(tags=["catalog"])


# --------------------------------------------------------------------------- helpers
def _pct(v: float) -> None:
    if v is None or v < 0 or v > 100:
        raise HTTPException(status_code=400, detail="Commission must be between 0 and 100")


def _validate_range(min_c: float, max_c: float) -> None:
    _pct(min_c)
    _pct(max_c)
    if min_c > max_c:
        raise HTTPException(status_code=400, detail="min_commission cannot exceed max_commission")


async def _validate_product_commission(db, category_id: str, commission: float) -> dict:
    """Fetch category and enforce commission within its current range.
    Raises HTTP 400 with a customer-facing message on failure.
    """
    if commission is None:
        raise HTTPException(status_code=400, detail="commission_percentage is required")
    _pct(commission)
    cat = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=400, detail="Category does not exist")
    lo = cat.get("min_commission", 0)
    hi = cat.get("max_commission", 100)
    if commission < lo or commission > hi:
        raise HTTPException(
            status_code=400,
            detail=f"Commission must be between {_fmt_pct(lo)}% and {_fmt_pct(hi)}% for {cat['name']} category.",
        )
    return cat


def _fmt_pct(v) -> str:
    """Render commission as int when whole (5.0 → '5'), keep decimals otherwise (7.5 → '7.5')."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    return str(int(f)) if f.is_integer() else (f"{f:.2f}".rstrip("0").rstrip("."))


# ============ CATEGORIES ============
@router.get("/categories")
async def list_categories(active: bool | None = None):
    db = get_db()
    filt = {}
    if active is not None:
        filt["active"] = active
    cats = await db.categories.find(filt, {"_id": 0}).sort("name", 1).to_list(500)
    return {"items": cats}


@router.get("/categories/{cat_id}")
async def get_category(cat_id: str):
    db = get_db()
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat


@router.post("/categories", status_code=201)
async def create_category(body: CategoryCreate, current_user: dict = Depends(require_admin)):
    _validate_range(body.min_commission, body.max_commission)
    db = get_db()
    doc = {
        "id": new_id(),
        "name": body.name,
        "description": body.description,
        "icon": body.icon,
        "active": body.active,
        "min_commission": body.min_commission,
        "max_commission": body.max_commission,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "category.create", "category", doc["id"], {
        "min_commission": body.min_commission, "max_commission": body.max_commission,
    })
    return doc


@router.patch("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryUpdate, current_user: dict = Depends(require_admin)):
    db = get_db()
    existing = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}

    # If either bound changes, validate the resulting range
    new_min = updates.get("min_commission", existing.get("min_commission", 0))
    new_max = updates.get("max_commission", existing.get("max_commission", 100))
    if "min_commission" in updates or "max_commission" in updates:
        _validate_range(new_min, new_max)

    updates["updated_at"] = utcnow()
    await db.categories.update_one({"id": cat_id}, {"$set": updates})
    await log_event(current_user, "category.update", "category", cat_id, {"fields": list(updates.keys())})
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return cat


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, current_user: dict = Depends(require_admin)):
    db = get_db()
    result = await db.categories.update_one({"id": cat_id}, {"$set": {"active": False, "updated_at": utcnow()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    await log_event(current_user, "category.deactivate", "category", cat_id)
    return {"ok": True}


# ============ PRODUCTS ============
async def _decorate_out_of_range(db, products: list[dict]) -> list[dict]:
    """Attach out_of_range flag comparing each product's commission_percentage
    to its category's *current* min/max."""
    if not products:
        return products
    cat_ids = list({p.get("category_id") for p in products if p.get("category_id")})
    cats: dict = {}
    async for c in db.categories.find({"id": {"$in": cat_ids}}, {"_id": 0}):
        cats[c["id"]] = c
    for p in products:
        cat = cats.get(p.get("category_id"))
        c = p.get("commission_percentage")
        p["category_name"] = cat["name"] if cat else None
        p["category_min_commission"] = cat.get("min_commission") if cat else None
        p["category_max_commission"] = cat.get("max_commission") if cat else None
        p["out_of_range"] = bool(
            cat and c is not None and (c < cat.get("min_commission", 0) or c > cat.get("max_commission", 100))
        )
    return products


@router.get("/products")
async def list_products(
    q: str | None = None,
    category_id: str | None = None,
    seller_id: str | None = None,
    active: bool | None = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
):
    db = get_db()
    filt: dict = {}
    if category_id:
        filt["category_id"] = category_id
    if seller_id:
        filt["seller_id"] = seller_id
    if active is not None:
        filt["active"] = active
    if q:
        filt["name"] = {"$regex": q, "$options": "i"}
    cursor = db.products.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    items = await _decorate_out_of_range(db, items)
    total = await db.products.count_documents(filt)
    return {"items": items, "total": total}


@router.get("/products/out-of-range")
async def list_out_of_range(_: dict = Depends(require_admin)):
    """Products whose stored commission_percentage now falls outside their
    category's current [min, max]. Presented for admin/seller correction."""
    db = get_db()
    items = await db.products.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    items = await _decorate_out_of_range(db, items)
    items = [p for p in items if p.get("out_of_range")]
    return {"items": items, "total": len(items)}


@router.post("/products", status_code=201)
async def create_product(
    body: ProductCreate,
    current_user: dict = Depends(require_roles(ROLE_SELLER, "manager", "staff_admin")),
):
    db = get_db()
    # Validate category exists + commission within range
    await _validate_product_commission(db, body.category_id, body.commission_percentage)

    seller_id = body.seller_id
    if current_user["role"] == ROLE_SELLER:
        seller_id = current_user["id"]  # sellers can only create for themselves
    if not seller_id:
        raise HTTPException(status_code=400, detail="seller_id required")

    doc = {
        "id": new_id(),
        "name": body.name,
        "description": body.description,
        "category_id": body.category_id,
        "seller_id": seller_id,
        "price": body.price,
        "mrp": body.mrp or body.price,
        "stock": body.stock,
        "unit": body.unit,
        "image_base64": body.image_base64,
        "active": body.active,
        "commission_percentage": body.commission_percentage,
        "weight_kg": body.weight_kg,
        "is_bulky": body.is_bulky,
        "bulky_charge": body.bulky_charge,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "product.create", "product", doc["id"], {
        "commission_percentage": body.commission_percentage,
    })
    return doc


@router.patch("/products/{prod_id}")
async def update_product(
    prod_id: str,
    body: ProductUpdate,
    current_user: dict = Depends(require_roles(ROLE_SELLER, "manager", "staff_admin")),
):
    db = get_db()
    product = await db.products.find_one({"id": prod_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if current_user["role"] == ROLE_SELLER and product.get("seller_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sellers can only update their own products")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}

    # Re-validate commission if category or commission changes
    if "commission_percentage" in updates or "category_id" in updates:
        new_cat_id = updates.get("category_id", product["category_id"])
        new_commission = updates.get("commission_percentage", product.get("commission_percentage"))
        await _validate_product_commission(db, new_cat_id, new_commission)

    updates["updated_at"] = utcnow()
    await db.products.update_one({"id": prod_id}, {"$set": updates})
    await log_event(current_user, "product.update", "product", prod_id, {"fields": list(updates.keys())})
    prod = await db.products.find_one({"id": prod_id}, {"_id": 0})
    return prod


@router.delete("/products/{prod_id}")
async def delete_product(prod_id: str, current_user: dict = Depends(require_admin)):
    db = get_db()
    result = await db.products.update_one({"id": prod_id}, {"$set": {"active": False, "updated_at": utcnow()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    await log_event(current_user, "product.deactivate", "product", prod_id)
    return {"ok": True}
