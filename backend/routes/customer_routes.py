"""Customer self-service routes: my-orders, addresses, coupon validate (public wrap)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import log_event
from auth import get_current_user, hash_password, verify_password
from db import get_db
from models import new_id, utcnow

router = APIRouter(tags=["customer"], prefix="/customer")


class AddressCreate(BaseModel):
    label: str = "Home"
    name: str
    mobile: str
    line1: str
    line2: str | None = None
    landmark: str | None = None
    city: str
    state: str
    pincode: str
    lat: float | None = None
    lng: float | None = None
    is_default: bool = False


class AddressUpdate(BaseModel):
    label: str | None = None
    name: str | None = None
    mobile: str | None = None
    line1: str | None = None
    line2: str | None = None
    landmark: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    lat: float | None = None
    lng: float | None = None
    is_default: bool | None = None


class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


@router.get("/profile")
async def my_profile(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/profile")
async def update_profile(body: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        return {"ok": True}
    updates["updated_at"] = utcnow()
    await db.users.update_one({"id": current_user["id"]}, {"$set": updates})
    return await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})


@router.post("/change-password")
async def change_password(body: PasswordChange, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]})
    if not user or not verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "updated_at": utcnow()}},
    )
    return {"ok": True}


# ============ Addresses ============
@router.get("/addresses")
async def my_addresses(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "addresses": 1})
    return {"items": (user or {}).get("addresses", [])}


@router.post("/addresses", status_code=201)
async def add_address(body: AddressCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    addr = body.model_dump()
    addr["id"] = new_id()
    addr["created_at"] = utcnow()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "addresses": 1})
    existing = (user or {}).get("addresses", []) or []
    # If flagged default (or first address), unset others
    if body.is_default or not existing:
        for e in existing:
            e["is_default"] = False
        addr["is_default"] = True
    existing.append(addr)
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"addresses": existing, "updated_at": utcnow()}})
    return addr


@router.patch("/addresses/{address_id}")
async def update_address(address_id: str, body: AddressUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "addresses": 1})
    addresses = (user or {}).get("addresses", []) or []
    found = None
    for a in addresses:
        if a["id"] == address_id:
            found = a
            for k, v in body.model_dump(exclude_unset=True).items():
                if v is not None:
                    a[k] = v
            break
    if not found:
        raise HTTPException(status_code=404, detail="Address not found")
    if body.is_default:
        for a in addresses:
            a["is_default"] = a["id"] == address_id
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"addresses": addresses, "updated_at": utcnow()}})
    return found


@router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "addresses": 1})
    addresses = [a for a in ((user or {}).get("addresses", []) or []) if a["id"] != address_id]
    # If we deleted the default, promote first remaining
    if addresses and not any(a.get("is_default") for a in addresses):
        addresses[0]["is_default"] = True
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"addresses": addresses, "updated_at": utcnow()}})
    return {"ok": True}


# ============ Orders ============
@router.get("/orders")
async def my_orders(
    status: str | None = None,
    limit: int = Query(50, le=100),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    filt: dict = {"customer_id": current_user["id"]}
    if status: filt["status"] = status
    cursor = db.orders.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    # Strip commission from items
    for o in items:
        for it in o.get("items", []):
            it.pop("commission_percentage", None)
            it.pop("line_commission", None)
        o.pop("commission", None)
    return {"items": items, "total": await db.orders.count_documents(filt)}


@router.get("/orders/{order_id}")
async def my_order_detail(order_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"id": order_id, "customer_id": current_user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Strip commission
    for it in order.get("items", []):
        it.pop("commission_percentage", None)
        it.pop("line_commission", None)
    order.pop("commission", None)

    # Attach delivery info
    delivery = await db.deliveries.find_one({"order_id": order_id}, {"_id": 0})
    if delivery:
        delivery.pop("verification_code_hash", None)
        # Attach rider name if assigned
        if delivery.get("rider_id"):
            rider = await db.users.find_one({"id": delivery["rider_id"]}, {"_id": 0, "name": 1, "mobile": 1})
            if rider:
                delivery["rider_name"] = rider.get("name")
                delivery["rider_mobile"] = rider.get("mobile")

    # Invoice
    invoice = await db.invoices.find_one({"order_id": order_id}, {"_id": 0, "invoice_number": 1, "grand_total": 1, "issued_at": 1, "status": 1})

    return {"order": order, "delivery": delivery, "invoice": invoice}


class CouponApply(BaseModel):
    code: str
    order_subtotal: float
    delivery_charge: float = 0.0
    category_ids: list[str] = []
    product_ids: list[str] = []


@router.post("/coupons/apply")
async def apply_coupon(body: CouponApply, current_user: dict = Depends(get_current_user)):
    """Thin wrapper over the existing coupon validate — returns the same shape."""
    from routes.coupon_routes import validate_coupon, CouponValidate
    v = CouponValidate(
        code=body.code, order_subtotal=body.order_subtotal,
        delivery_charge=body.delivery_charge, customer_id=current_user["id"],
        category_ids=body.category_ids, product_ids=body.product_ids,
    )
    return await validate_coupon(v, current_user)
