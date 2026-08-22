"""Order + Delivery + Delivery Verification Code routes."""
import math
import random
from fastapi import APIRouter, Depends, HTTPException, Query

from audit import log_event
from auth import (
    ROLE_CUSTOMER,
    ROLE_RIDER,
    ROLE_SELLER,
    get_current_user,
    require_admin,
    require_roles,
)
from db import get_db
from delivery_engine import calculate_delivery_charge
from models import (
    CheckoutPreviewRequest,
    DeliveryAssign,
    DeliveryVerify,
    OrderCreate,
    OrderStatusUpdate,
    RiderLocationUpdate,
    new_id,
    utcnow,
)

router = APIRouter(tags=["orders"])

ORDER_STATUSES = ["placed", "accepted", "packed", "out_for_delivery", "delivered", "cancelled"]


# ============ CHECKOUT PREVIEW (Enterprise Delivery Charge Engine — Point 1) ============
@router.post("/checkout/preview")
async def checkout_preview(body: CheckoutPreviewRequest, current_user: dict = Depends(get_current_user)):
    """Return the delivery-charge breakdown using server-authoritative product data."""
    db = get_db()
    rules = await db.business_rules.find_one({"id": "default"}, {"_id": 0}) or {}

    prod_ids = list(dict.fromkeys(i.product_id for i in body.items))
    prods: dict = {}
    subtotal = 0.0
    async for p in db.products.find(
        {"id": {"$in": prod_ids}, "active": True},
        {"_id": 0, "id": 1, "name": 1, "price": 1, "stock": 1, "weight_kg": 1,
         "is_bulky": 1, "bulky_charge": 1, "seller_id": 1},
    ):
        prods[p["id"]] = p

    line_items: list[dict] = []
    requested: dict[str, int] = {}
    for it in body.items:
        requested[it.product_id] = requested.get(it.product_id, 0) + it.qty

    for product_id, qty in requested.items():
        p = prods.get(product_id)
        if not p:
            raise HTTPException(status_code=400, detail=f"Product unavailable: {product_id}")
        stock = int(p.get("stock", 0) or 0)
        if qty > stock:
            raise HTTPException(status_code=400, detail=f"Only {stock} unit(s) available for {p.get('name') or product_id}")
        price = float(p.get("price", 0) or 0)
        subtotal += price * qty
        line_items.append({"product_id": product_id, "qty": qty, "name": p.get("name"), "price": price, "seller_id": p.get("seller_id")})

    # Client-provided order_subtotal is intentionally ignored; totals are authoritative on the server.

    seller_lat = body.seller_lat
    seller_lng = body.seller_lng
    if seller_lat is None or seller_lng is None:
        for it in line_items:
            if it.get("seller_id"):
                seller = await db.users.find_one({"id": it["seller_id"]}, {"_id": 0, "address_lat": 1, "address_lng": 1})
                if seller and seller.get("address_lat") is not None and seller.get("address_lng") is not None:
                    seller_lat = seller["address_lat"]
                    seller_lng = seller["address_lng"]
                    break

    breakdown = calculate_delivery_charge(
        rules=rules,
        items=line_items,
        products_by_id=prods,
        customer_lat=body.customer_lat,
        customer_lng=body.customer_lng,
        seller_lat=seller_lat,
        seller_lng=seller_lng,
        order_subtotal=subtotal,
    )

    min_order = float(rules.get("min_order_amount") or 0)
    meets_min = subtotal >= min_order

    return {
        "subtotal": round(subtotal, 2),
        "meets_minimum_order": meets_min,
        "minimum_order_amount": min_order,
        "delivery_breakdown": breakdown,
        "estimated_total": round(subtotal + float(breakdown.get("final_delivery_charge") or 0), 2) if not breakdown.get("reject") else None,
    }


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


async def _get_rules(db) -> dict:
    rules = await db.business_rules.find_one({"id": "default"}, {"_id": 0})
    return rules or {}


# ============ ORDERS ============
@router.post("/orders", status_code=201)
async def create_order(
    body: OrderCreate,
    current_user: dict = Depends(require_roles(ROLE_CUSTOMER, "manager", "staff_admin")),
):
    db = get_db()
    rules = await _get_rules(db)

    # CUSTOMER identity is always taken from the authenticated session; clients cannot place orders for another customer.
    customer_id = current_user["id"] if current_user["role"] == ROLE_CUSTOMER else (body.customer_id or current_user["id"])

    prod_ids = list(dict.fromkeys(i.product_id for i in body.items))
    prods: dict = {}
    async for p in db.products.find(
        {"id": {"$in": prod_ids}, "active": True},
        {"_id": 0, "id": 1, "name": 1, "price": 1, "stock": 1, "commission_percentage": 1,
         "weight_kg": 1, "is_bulky": 1, "bulky_charge": 1, "seller_id": 1},
    ):
        prods[p["id"]] = p

    # Build order lines entirely from database truth. Client name/price/seller_id are ignored.
    requested: dict[str, int] = {}
    for item in body.items:
        requested[item.product_id] = requested.get(item.product_id, 0) + item.qty

    subtotal = 0.0
    server_items: list[dict] = []
    for product_id, qty in requested.items():
        p = prods.get(product_id)
        if not p:
            raise HTTPException(status_code=400, detail=f"Product unavailable: {product_id}")
        stock = int(p.get("stock", 0) or 0)
        if qty > stock:
            raise HTTPException(status_code=400, detail=f"Only {stock} unit(s) available for {p.get('name') or product_id}")
        price = float(p.get("price", 0) or 0)
        if price < 0:
            raise HTTPException(status_code=400, detail=f"Invalid price configured for {p.get('name') or product_id}")
        subtotal += price * qty
        server_items.append({
            "product_id": product_id,
            "name": p.get("name") or product_id,
            "price": price,
            "qty": qty,
            "seller_id": p.get("seller_id"),
        })

    if rules.get("min_order_amount") and subtotal < float(rules["min_order_amount"]):
        raise HTTPException(status_code=400, detail=f"Minimum order amount is ₹{rules['min_order_amount']}")

    # --- Seller location (Delivery Engine): prefer first item's seller lat/lng, else business_rules default ---
    seller_lat = None
    seller_lng = None
    for item in server_items:
        sid = item.get("seller_id")
        if not sid:
            continue
        seller = await db.users.find_one({"id": sid}, {"_id": 0, "address_lat": 1, "address_lng": 1})
        if seller and seller.get("address_lat") is not None and seller.get("address_lng") is not None:
            seller_lat = seller["address_lat"]
            seller_lng = seller["address_lng"]
            break

    # --- Delivery Charge Engine (Point 1) ---
    breakdown = calculate_delivery_charge(
        rules=rules,
        items=server_items,
        products_by_id=prods,
        customer_lat=body.delivery_lat,
        customer_lng=body.delivery_lng,
        seller_lat=seller_lat,
        seller_lng=seller_lng,
        order_subtotal=subtotal,
    )
    if breakdown.get("reject"):
        raise HTTPException(status_code=400, detail=breakdown["message"])
    delivery_charge = float(breakdown["final_delivery_charge"])

    # --- Per-product commission using authoritative server prices ---
    commission = 0.0
    enriched_items: list[dict] = []
    for item in server_items:
        p = prods[item["product_id"]]
        pct = float(p.get("commission_percentage") if p.get("commission_percentage") is not None else rules.get("commission_percent", 10.0))
        line = dict(item)
        line["commission_percentage"] = pct
        line["line_commission"] = round(item["price"] * item["qty"] * pct / 100, 2)
        commission += line["line_commission"]
        enriched_items.append(line)
    commission = round(commission, 2)

    order_id = new_id()
    now = utcnow()
    order = {
        "id": order_id,
        "customer_id": customer_id,
        "items": enriched_items,
        "subtotal": round(subtotal, 2),
        "delivery_charge": delivery_charge,
        "delivery_breakdown": breakdown,
        "commission": commission,
        "total": round(subtotal + delivery_charge, 2),
        "delivery_address": body.delivery_address,
        "delivery_lat": body.delivery_lat,
        "delivery_lng": body.delivery_lng,
        "payment_method": body.payment_method,
        "payment_status": "pending",
        "status": "placed",
        "notes": body.notes,
        "created_at": now,
        "updated_at": now,
        "status_history": [{"status": "placed", "at": now, "by": current_user["id"]}],
    }

    # -- COD limit enforcement (Point 2) --
    if body.payment_method == "cod":
        cod_enabled = bool(rules.get("cod_enabled", True))
        cod_limit = float(rules.get("cod_limit", 0) or 0)
        if not cod_enabled:
            raise HTTPException(status_code=400, detail="Cash on Delivery is currently disabled")
        if cod_limit > 0 and order["total"] > cod_limit:
            raise HTTPException(
                status_code=400,
                detail=f"Cash on Delivery limit is ₹{cod_limit:.0f}. Please choose UPI or PhonePe for orders above this amount.",
            )

    # -- Payment method enable checks --
    if body.payment_method == "upi" and not bool(rules.get("upi_intent_enabled", True)):
        raise HTTPException(status_code=400, detail="UPI Intent payments are currently disabled")
    if body.payment_method == "phonepe" and not bool(rules.get("phonepe_enabled", True)):
        raise HTTPException(status_code=400, detail="PhonePe payments are currently disabled")

    # -- Atomic stock reservation --
    # Reserve before creating the order so an order can never be created with insufficient stock.
    reserved: list[tuple[str, int]] = []
    try:
        for item in server_items:
            result = await db.products.update_one(
                {"id": item["product_id"], "active": True, "stock": {"$gte": item["qty"]}},
                {"$inc": {"stock": -item["qty"]}, "$set": {"updated_at": utcnow()}},
            )
            if result.matched_count != 1:
                raise HTTPException(status_code=409, detail=f"Stock changed. Please review {item['name']} and try again.")
            reserved.append((item["product_id"], item["qty"]))
    except HTTPException:
        for product_id, qty in reserved:
            await db.products.update_one({"id": product_id}, {"$inc": {"stock": qty}, "$set": {"updated_at": utcnow()}})
        raise
    except Exception:
        for product_id, qty in reserved:
            await db.products.update_one({"id": product_id}, {"$inc": {"stock": qty}, "$set": {"updated_at": utcnow()}})
        raise HTTPException(status_code=500, detail="Unable to reserve inventory. Please try again.")

    # Persist the order only after all stock reservations succeeded. Roll back reservations if persistence fails.
    try:
        await db.orders.insert_one(order)
    except Exception:
        for product_id, qty in reserved:
            await db.products.update_one({"id": product_id}, {"$inc": {"stock": qty}, "$set": {"updated_at": utcnow()}})
        raise HTTPException(status_code=500, detail="Unable to create order. Inventory reservation was rolled back.")
    order.pop("_id", None)

    # Record stock movements after the order is safely persisted. Logging failure must not corrupt the order flow.
    try:
        from routes.inventory_routes import log_stock_movement
        for product_id, qty in reserved:
            p = prods[product_id]
            previous_stock = int(p.get("stock", 0) or 0)
            await log_stock_movement(
                db, current_user, product_id, "order_reserved",
                previous_stock, max(0, previous_stock - qty), reason=f"Order placed ({qty} units)", order_id=order_id,
            )
    except Exception as exc:
        import logging
        logging.getLogger("neds").error("Stock movement logging failed for order %s: %s", order_id, exc)
        await log_event(current_user, "inventory.log_error", "order", order_id, {"error": str(exc)})

    # -- Auto-initiate PhonePe transaction when payment_method=phonepe (Point 24) --
    if body.payment_method == "phonepe":
        from uuid import uuid4
        from phonepe_gateway import gateway as phonepe_gw, to_paise
        merchant_order_id = f"NEDS_{uuid4().hex[:20]}"
        pp_resp = await phonepe_gw.create_order(
            merchant_order_id=merchant_order_id,
            amount_paise=to_paise(order["total"]),
            redirect_url=f"neds://payments/return?order={merchant_order_id}",
            meta_info={"neds_order_id": order_id},
        )
        now = utcnow()
        txn = {
            "id": new_id(),
            "gateway": "phonepe",
            "merchant_order_id": merchant_order_id,
            "phonepe_order_id": pp_resp.get("orderId"),
            "linked_order_id": order_id,
            "customer_id": customer_id,
            "amount_paise": to_paise(order["total"]),
            "amount_inr": order["total"],
            "currency": "INR",
            "status": (pp_resp.get("state") or "PENDING").upper(),
            "checkout_url": pp_resp.get("redirectUrl"),
            "redirect_url": f"neds://payments/return?order={merchant_order_id}",
            "idempotency_key": f"order-{order_id}",
            "metadata": {"neds_order_id": order_id},
            "gateway_response": pp_resp,
            "placeholder_mode": bool(pp_resp.get("_placeholder")),
            "refunds": [],
            "created_at": now,
            "updated_at": now,
        }
        await db.payment_transactions.insert_one(txn)
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"payment_gateway": "phonepe", "payment_gateway_txn_id": txn["id"], "updated_at": now}},
        )
        order["payment_gateway"] = "phonepe"
        order["phonepe_checkout_url"] = txn["checkout_url"]
        order["phonepe_merchant_order_id"] = merchant_order_id

    # Create pending delivery record
    delivery = {
        "id": new_id(),
        "order_id": order_id,
        "rider_id": None,
        "status": "pending_assignment",
        "rider_lat": None,
        "rider_lng": None,
        "verification_code": None,
        "verification_generated_at": None,
        "verified_at": None,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    await db.deliveries.insert_one(delivery)
    delivery.pop("_id", None)

    await log_event(current_user, "order.create", "order", order_id, {"total": order["total"]})
    return order


@router.get("/orders")
async def list_orders(
    status: str | None = None,
    customer_id: str | None = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    filt: dict = {}
    if status:
        filt["status"] = status
    if customer_id:
        filt["customer_id"] = customer_id

    # Role-scoped visibility
    if current_user["role"] == ROLE_CUSTOMER:
        filt["customer_id"] = current_user["id"]
    elif current_user["role"] == ROLE_SELLER:
        filt["items.seller_id"] = current_user["id"]
    elif current_user["role"] == ROLE_RIDER:
        # riders see orders assigned to their deliveries
        deliveries = await db.deliveries.find({"rider_id": current_user["id"]}, {"_id": 0, "order_id": 1}).to_list(500)
        order_ids = [d["order_id"] for d in deliveries]
        filt["id"] = {"$in": order_ids}

    cursor = db.orders.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    total = await db.orders.count_documents(filt)
    return {"items": items, "total": total}


@router.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user["role"] == ROLE_CUSTOMER and order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    delivery = await db.deliveries.find_one({"order_id": order_id}, {"_id": 0})
    order["delivery"] = delivery
    # Verification code visible only to customer or admin
    if delivery and current_user["role"] not in {"customer", "super_admin", "manager", "staff_admin"}:
        if "verification_code" in delivery and current_user["role"] != "customer":
            delivery.pop("verification_code", None)
    return order


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    body: OrderStatusUpdate,
    current_user: dict = Depends(require_roles(ROLE_SELLER, ROLE_RIDER, "manager", "staff_admin")),
):
    db = get_db()
    if body.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {ORDER_STATUSES}")
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if body.status == "delivered":
        raise HTTPException(status_code=400, detail="Use /deliveries/verify to mark delivered")
    entry = {"status": body.status, "at": utcnow(), "by": current_user["id"]}
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": body.status, "updated_at": utcnow()}, "$push": {"status_history": entry}},
    )
    await log_event(current_user, "order.status", "order", order_id, {"status": body.status})
    return {"ok": True, "status": body.status}


# ============ DELIVERIES ============
@router.get("/deliveries")
async def list_deliveries(
    status: str | None = None,
    rider_id: str | None = None,
    limit: int = Query(200, le=500),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    filt: dict = {}
    if status:
        filt["status"] = status
    if rider_id:
        filt["rider_id"] = rider_id
    if current_user["role"] == ROLE_RIDER:
        filt["rider_id"] = current_user["id"]
    cursor = db.deliveries.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    return {"items": items}


@router.post("/deliveries/{delivery_id}/assign")
async def assign_rider(
    delivery_id: str,
    body: DeliveryAssign,
    current_user: dict = Depends(require_admin),
):
    db = get_db()
    rider = await db.users.find_one({"id": body.rider_id, "role": "rider"})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    result = await db.deliveries.update_one(
        {"id": delivery_id},
        {"$set": {"rider_id": body.rider_id, "status": "assigned", "updated_at": utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Delivery not found")
    delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    await db.orders.update_one(
        {"id": delivery["order_id"]},
        {"$set": {"status": "accepted", "updated_at": utcnow()},
         "$push": {"status_history": {"status": "accepted", "at": utcnow(), "by": current_user["id"]}}},
    )
    await log_event(current_user, "delivery.assign", "delivery", delivery_id, {"rider_id": body.rider_id})
    return {"ok": True}


@router.post("/deliveries/{delivery_id}/location")
async def update_rider_location(
    delivery_id: str,
    body: RiderLocationUpdate,
    current_user: dict = Depends(require_roles(ROLE_RIDER)),
):
    """Called by rider app frequently. Also auto-generates verification code once rider enters delivery radius."""
    db = get_db()
    delivery = await db.deliveries.find_one({"id": delivery_id})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery.get("rider_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your delivery")

    order = await db.orders.find_one({"id": delivery["order_id"]}, {"_id": 0})
    rules = await _get_rules(db)
    radius = rules.get("verification_radius_meters", 200)

    updates = {
        "rider_lat": body.lat,
        "rider_lng": body.lng,
        "updated_at": utcnow(),
    }

    # Auto-generate verification code once rider enters radius (only once)
    if order and not delivery.get("verification_code"):
        dist = haversine_m(body.lat, body.lng, order["delivery_lat"], order["delivery_lng"])
        if dist <= radius:
            code = f"{random.randint(0, 9999):04d}"
            updates["verification_code"] = code
            updates["verification_generated_at"] = utcnow()
            updates["status"] = "at_customer"
            await log_event(current_user, "delivery.code_generated", "delivery", delivery_id, {
                "distance_m": round(dist, 1), "radius_m": radius,
            })

    await db.deliveries.update_one({"id": delivery_id}, {"$set": updates})
    delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    # Rider must NOT see the verification code
    delivery.pop("verification_code", None)
    return delivery


@router.post("/deliveries/{delivery_id}/verify")
async def verify_delivery(
    delivery_id: str,
    body: DeliveryVerify,
    current_user: dict = Depends(require_roles(ROLE_RIDER)),
):
    """Rider enters the code shown in customer's app. Marks order Delivered on match."""
    db = get_db()
    delivery = await db.deliveries.find_one({"id": delivery_id})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery.get("rider_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your delivery")
    if not delivery.get("verification_code"):
        raise HTTPException(status_code=400, detail="Verification code not yet generated — approach customer location")
    if body.code.strip() != delivery["verification_code"]:
        await log_event(current_user, "delivery.verify_failed", "delivery", delivery_id)
        raise HTTPException(status_code=400, detail="Incorrect verification code")

    order = await db.orders.find_one({"id": delivery["order_id"]}, {"_id": 0})
    customer_lat = order["delivery_lat"]
    customer_lng = order["delivery_lng"]

    verification_record = {
        "id": new_id(),
        "order_id": delivery["order_id"],
        "delivery_id": delivery_id,
        "rider_id": current_user["id"],
        "code": delivery["verification_code"],
        "rider_lat": body.rider_lat,
        "rider_lng": body.rider_lng,
        "customer_lat": customer_lat,
        "customer_lng": customer_lng,
        "distance_m": round(haversine_m(body.rider_lat, body.rider_lng, customer_lat, customer_lng), 2),
        "verified_at": utcnow(),
    }
    await db.delivery_verifications.insert_one(verification_record)
    verification_record.pop("_id", None)

    now = utcnow()
    await db.deliveries.update_one(
        {"id": delivery_id},
        {"$set": {"status": "delivered", "verified_at": now, "updated_at": now}},
    )
    await db.orders.update_one(
        {"id": delivery["order_id"]},
        {"$set": {"status": "delivered", "payment_status": "paid" if order["payment_method"] == "cod" else order.get("payment_status", "pending"), "updated_at": now},
         "$push": {"status_history": {"status": "delivered", "at": now, "by": current_user["id"]}}},
    )
    await log_event(current_user, "delivery.verified", "delivery", delivery_id, {"order_id": delivery["order_id"]})

    # Auto-create seller & rider earnings (Points 3 & 4)
    try:
        from routes.settlement_routes import create_earnings_for_delivered_order
        fresh_order = await db.orders.find_one({"id": delivery["order_id"]}, {"_id": 0})
        fresh_delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
        earnings = await create_earnings_for_delivered_order(db, fresh_order, fresh_delivery)
        verification_record["seller_earnings_created"] = len(earnings.get("seller_earnings", []))
        verification_record["rider_earning_created"] = bool(earnings.get("rider_earning"))
    except Exception as _e:
        # Never let settlement creation break the delivery-verify flow, but DO log it (Point 17 fix)
        import logging
        logging.getLogger("neds").error("Settlement earnings creation failed for order %s: %s", delivery["order_id"], _e)
        await log_event(current_user, "settlement.error", "order", delivery["order_id"], {"error": str(_e)})

    # Auto-generate invoice on delivery (Point 19)
    try:
        from routes.invoice_routes import generate_invoice_for_order
        fresh_order2 = await db.orders.find_one({"id": delivery["order_id"]}, {"_id": 0})
        if fresh_order2:
            inv = await generate_invoice_for_order(db, fresh_order2, actor=current_user, force=False)
            verification_record["invoice_number"] = inv.get("invoice_number")
    except Exception as _e:
        import logging
        logging.getLogger("neds").error("Invoice generation failed for order %s: %s", delivery["order_id"], _e)
        await log_event(current_user, "invoice.error", "order", delivery["order_id"], {"error": str(_e)})

    return {"ok": True, "verification": verification_record}


@router.get("/delivery-verifications")
async def list_verifications(limit: int = Query(200, le=500), _: dict = Depends(require_admin)):
    db = get_db()
    items = await db.delivery_verifications.find({}, {"_id": 0}).sort("verified_at", -1).limit(limit).to_list(limit)
    return {"items": items}
