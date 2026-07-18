"""Category and Product routes."""
from fastapi import APIRouter, Depends, HTTPException, Query

from audit import log_event
from auth import ROLE_SELLER, get_current_user, require_admin, require_roles
from db import get_db
from models import CategoryCreate, CategoryUpdate, ProductCreate, ProductUpdate, new_id, utcnow

router = APIRouter(tags=["catalog"])


# ============ CATEGORIES ============
@router.get("/categories")
async def list_categories(active: bool | None = None):
    db = get_db()
    filt = {}
    if active is not None:
        filt["active"] = active
    cats = await db.categories.find(filt, {"_id": 0}).sort("name", 1).to_list(500)
    return {"items": cats}


@router.post("/categories", status_code=201)
async def create_category(body: CategoryCreate, current_user: dict = Depends(require_admin)):
    db = get_db()
    doc = {
        "id": new_id(),
        "name": body.name,
        "description": body.description,
        "icon": body.icon,
        "active": body.active,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "category.create", "category", doc["id"])
    return doc


@router.patch("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryUpdate, current_user: dict = Depends(require_admin)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    updates["updated_at"] = utcnow()
    result = await db.categories.update_one({"id": cat_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    await log_event(current_user, "category.update", "category", cat_id)
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
    total = await db.products.count_documents(filt)
    return {"items": items, "total": total}


@router.post("/products", status_code=201)
async def create_product(
    body: ProductCreate,
    current_user: dict = Depends(require_roles(ROLE_SELLER, "manager", "staff_admin")),
):
    db = get_db()
    # Verify category exists
    if not await db.categories.find_one({"id": body.category_id}):
        raise HTTPException(status_code=400, detail="Category does not exist")

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
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "product.create", "product", doc["id"])
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
