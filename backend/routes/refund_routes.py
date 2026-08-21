"""Return / Refund / Cancellation Engine (Point 12).

Business flow:
1. Customer or Admin creates a return request for a delivered order (or line items).
2. Admin approves/rejects the return.
3. On approval, admin schedules pickup; rider picks up and confirms.
4. Refund is processed (marked paid or auto through payment gateway).
5. Seller earnings are adjusted (reversed for the returned amount).

Cancellations are for pre-delivery orders (status != delivered):
- Customer/Admin can cancel while status ∈ {placed, accepted, packed, out_for_delivery}.
- Auto-refund initiated if payment was captured (UPI/PhonePe).
- Rider earnings NOT created (delivery never verified).

Refunds are the actual money-return step — linked to either a return or a cancellation.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import log_event
from auth import get_current_user, ROLE_CUSTOMER
from db import get_db
from models import new_id, utcnow
from rbac import require_permission

router = APIRouter(tags=["returns"])


RETURN_REASONS = [
    "damaged", "wrong_item", "defective", "not_as_described", "changed_mind",
    "size_issue", "quality_issue", "expired", "missing_parts", "other",
]

RETURN_STATUSES = ["requested", "approved", "rejected", "pickup_scheduled", "picked_up", "refunded", "closed"]
CANCEL_STATUSES = ["requested", "approved", "rejected", "completed"]
REFUND_STATUSES = ["pending", "processing", "completed", "failed"]


# ---------- Pydantic models ----------
class ReturnLineItem(BaseModel):
    product_id: str
    qty: int = Field(gt=0)


class ReturnCreate(BaseModel):
    order_id: str
    reason: str
    description: str | None = None
    items: list[ReturnLineItem] | None = None  # None = full order return
    pickup_address: str | None = None


class ReturnStatusUpdate(BaseModel):
    status: str
    admin_note: str | None = None


class CancellationCreate(BaseModel):
    order_id: str
    reason: str
    description: str | None = None


class CancellationStatusUpdate(BaseModel):
    status: str  # approved | rejected | completed
    admin_note: str | None = None


class RefundIssue(BaseModel):
    amount_inr: float | None = None  # None = compute from return/cancel record
    reason: str | None = None
    return_id: str | None = None
    cancellation_id: str | None = None
    order_id: str | None = None
    payout_reference: str | None = None  # UTR/txn ref
    notes: str | None = None


# ============ RETURNS ============
@router.post("/returns", status_code=201)
async def create_return(body: ReturnCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if body.reason not in RETURN_REASONS:
        raise HTTPException(status_code=400, detail=f"Reason must be one of: {RETURN_REASONS}")

    order = await db.orders.find_one({"id": body.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Customer can only return their own orders
    if current_user["role"] == ROLE_CUSTOMER and order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only return your own orders")

    if order["status"] != "delivered":
        raise HTTPException(status_code=400, detail=f"Only delivered orders can be returned (current: {order['status']})")

    # Prevent duplicate open returns for same order
    existing = await db.return_requests.find_one({
        "order_id": body.order_id,
        "status": {"$in": ["requested", "approved", "pickup_scheduled", "picked_up"]},
    })
    if existing:
        raise HTTPException(status_code=400, detail="An active return already exists for this order")

    # Compute refund amount from items subset (or full order)
    order_items = order.get("items", [])
    if body.items:
        item_map = {i["product_id"]: i for i in order_items}
        return_items: list[dict] = []
        refund_amount = 0.0
        for ri in body.items:
            oi = item_map.get(ri.product_id)
            if not oi:
                raise HTTPException(status_code=400, detail=f"Product {ri.product_id} is not in this order")
            if ri.qty > oi.get("qty", 0):
                raise HTTPException(status_code=400, detail=f"Return qty ({ri.qty}) exceeds ordered qty ({oi.get('qty')}) for {oi.get('name')}")
            line_total = float(oi.get("price", 0)) * ri.qty
            line_commission = round(line_total * float(oi.get("commission_percentage", 0)) / 100, 2)
            return_items.append({
                "product_id": ri.product_id,
                "name": oi.get("name"),
                "price": oi.get("price"),
                "qty": ri.qty,
                "line_total": round(line_total, 2),
                "line_commission": line_commission,
                "seller_id": oi.get("seller_id"),
                "commission_percentage": oi.get("commission_percentage", 0),
            })
            refund_amount += line_total
    else:
        # Full-order return
        return_items = [{
            "product_id": oi.get("product_id"),
            "name": oi.get("name"),
            "price": oi.get("price"),
            "qty": oi.get("qty"),
            "line_total": round(float(oi.get("price", 0)) * oi.get("qty", 0), 2),
            "line_commission": oi.get("line_commission", 0),
            "seller_id": oi.get("seller_id"),
            "commission_percentage": oi.get("commission_percentage", 0),
        } for oi in order_items]
        refund_amount = float(order.get("subtotal", 0))

    doc = {
        "id": new_id(),
        "order_id": body.order_id,
        "customer_id": order["customer_id"],
        "reason": body.reason,
        "description": body.description,
        "items": return_items,
        "refund_amount": round(refund_amount, 2),
        "status": "requested",
        "pickup_address": body.pickup_address or order.get("delivery_address"),
        "admin_note": None,
        "created_at": utcnow(),
        "updated_at": utcnow(),
        "created_by": current_user["id"],
        "status_history": [{"status": "requested", "at": utcnow(), "by": current_user["id"]}],
    }
    await db.return_requests.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "return.create", "return", doc["id"], {"order_id": body.order_id, "amount": doc["refund_amount"]})
    return doc


@router.get("/returns")
async def list_returns(
    status: str | None = None,
    order_id: str | None = None,
    customer_id: str | None = None,
    limit: int = Query(200, le=500),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    filt: dict = {}
    if status: filt["status"] = status
    if order_id: filt["order_id"] = order_id
    if customer_id: filt["customer_id"] = customer_id
    if current_user["role"] == ROLE_CUSTOMER:
        filt["customer_id"] = current_user["id"]
    cursor = db.return_requests.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    return {"items": items, "total": await db.return_requests.count_documents(filt)}


@router.get("/returns/{return_id}")
async def get_return(return_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    r = await db.return_requests.find_one({"id": return_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Return not found")
    if current_user["role"] == ROLE_CUSTOMER and r["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    # Attach linked refund transactions
    r["refunds"] = await db.refund_transactions.find({"return_id": return_id}, {"_id": 0}).to_list(20)
    return r


@router.patch("/returns/{return_id}/status")
async def update_return_status(
    return_id: str,
    body: ReturnStatusUpdate,
    current_user: dict = Depends(require_permission("returns.manage")),
):
    if body.status not in RETURN_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {RETURN_STATUSES}")
    db = get_db()
    r = await db.return_requests.find_one({"id": return_id})
    if not r:
        raise HTTPException(status_code=404, detail="Return not found")

    now = utcnow()
    entry = {"status": body.status, "at": now, "by": current_user["id"], "note": body.admin_note}
    await db.return_requests.update_one(
        {"id": return_id},
        {"$set": {"status": body.status, "updated_at": now, "admin_note": body.admin_note},
         "$push": {"status_history": entry}},
    )

    # On refunded: adjust seller earnings (reverse the returned amount)
    if body.status == "refunded":
        await _reverse_seller_earnings(db, r)

    await log_event(current_user, "return.status", "return", return_id, {"status": body.status})
    return await db.return_requests.find_one({"id": return_id}, {"_id": 0})


async def _reverse_seller_earnings(db, return_doc: dict):
    """When a return is refunded, deduct the returned amount from the affected seller's earnings.
    Creates a compensating negative earning row so the settlement engine picks it up.
    """
    # Group by seller
    per_seller: dict[str, dict] = {}
    for it in return_doc.get("items", []):
        sid = it.get("seller_id")
        if not sid:
            continue
        agg = per_seller.setdefault(sid, {"gross": 0.0, "commission": 0.0})
        agg["gross"] += float(it.get("line_total", 0))
        agg["commission"] += float(it.get("line_commission", 0))

    now = utcnow()
    for sid, agg in per_seller.items():
        gross = round(agg["gross"], 2)
        commission = round(agg["commission"], 2)
        net = round(gross - commission, 2)
        earning = {
            "id": new_id(),
            "seller_id": sid,
            "order_id": return_doc["order_id"],
            "return_id": return_doc["id"],
            "gross_amount": -gross,       # negative = reversal
            "commission_amount": -commission,
            "net_amount": -net,
            "status": "pending",
            "type": "return_reversal",
            "created_at": now,
            "updated_at": now,
        }
        # unique index is on order_id — use custom compound to allow return reversal alongside earning
        # so we set a synthetic order_id
        earning["order_id"] = f"{return_doc['order_id']}__return__{return_doc['id']}"
        await db.seller_earnings.insert_one(earning)


# ============ CANCELLATIONS ============
@router.post("/cancellations", status_code=201)
async def create_cancellation(body: CancellationCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"id": body.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user["role"] == ROLE_CUSTOMER and order["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only cancel your own orders")
    if order["status"] in ("delivered", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {order['status']} order — use Returns instead.")

    existing = await db.cancellation_requests.find_one({
        "order_id": body.order_id,
        "status": {"$in": ["requested", "approved"]},
    })
    if existing:
        raise HTTPException(status_code=400, detail="An active cancellation request already exists")

    now = utcnow()
    doc = {
        "id": new_id(),
        "order_id": body.order_id,
        "customer_id": order["customer_id"],
        "reason": body.reason,
        "description": body.description,
        "refund_amount": float(order.get("total", 0)) if order.get("payment_status") == "paid" else 0.0,
        "was_paid": order.get("payment_status") == "paid",
        "status": "requested",
        "admin_note": None,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"],
        "status_history": [{"status": "requested", "at": now, "by": current_user["id"]}],
    }
    await db.cancellation_requests.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "cancellation.create", "cancellation", doc["id"], {"order_id": body.order_id})
    return doc


@router.get("/cancellations")
async def list_cancellations(
    status: str | None = None,
    limit: int = Query(200, le=500),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    filt: dict = {}
    if status: filt["status"] = status
    if current_user["role"] == ROLE_CUSTOMER:
        filt["customer_id"] = current_user["id"]
    cursor = db.cancellation_requests.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    return {"items": items, "total": await db.cancellation_requests.count_documents(filt)}


@router.patch("/cancellations/{cancel_id}/status")
async def update_cancellation_status(
    cancel_id: str,
    body: CancellationStatusUpdate,
    current_user: dict = Depends(require_permission("returns.manage")),
):
    if body.status not in CANCEL_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {CANCEL_STATUSES}")
    db = get_db()
    c = await db.cancellation_requests.find_one({"id": cancel_id})
    if not c:
        raise HTTPException(status_code=404, detail="Cancellation not found")

    now = utcnow()
    entry = {"status": body.status, "at": now, "by": current_user["id"], "note": body.admin_note}
    await db.cancellation_requests.update_one(
        {"id": cancel_id},
        {"$set": {"status": body.status, "updated_at": now, "admin_note": body.admin_note},
         "$push": {"status_history": entry}},
    )
    # When completed: mark order cancelled
    if body.status == "completed":
        await db.orders.update_one(
            {"id": c["order_id"]},
            {"$set": {"status": "cancelled", "updated_at": now},
             "$push": {"status_history": {"status": "cancelled", "at": now, "by": current_user["id"]}}},
        )

    await log_event(current_user, "cancellation.status", "cancellation", cancel_id, {"status": body.status})
    return await db.cancellation_requests.find_one({"id": cancel_id}, {"_id": 0})


# ============ REFUNDS ============
@router.post("/refunds", status_code=201)
async def issue_refund(body: RefundIssue, current_user: dict = Depends(require_permission("payments.refund"))):
    db = get_db()

    if not (body.return_id or body.cancellation_id or body.order_id):
        raise HTTPException(status_code=400, detail="One of return_id, cancellation_id, or order_id is required")

    order_id = body.order_id
    linked_return = None
    linked_cancel = None
    default_amount = body.amount_inr

    if body.return_id:
        linked_return = await db.return_requests.find_one({"id": body.return_id}, {"_id": 0})
        if not linked_return:
            raise HTTPException(status_code=404, detail="Return not found")
        order_id = order_id or linked_return["order_id"]
        default_amount = default_amount if default_amount is not None else float(linked_return.get("refund_amount", 0))
    elif body.cancellation_id:
        linked_cancel = await db.cancellation_requests.find_one({"id": body.cancellation_id}, {"_id": 0})
        if not linked_cancel:
            raise HTTPException(status_code=404, detail="Cancellation not found")
        order_id = order_id or linked_cancel["order_id"]
        default_amount = default_amount if default_amount is not None else float(linked_cancel.get("refund_amount", 0))
    else:
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        default_amount = default_amount if default_amount is not None else float(order.get("total", 0))

    if default_amount is None or default_amount <= 0:
        raise HTTPException(status_code=400, detail="Refund amount must be greater than zero")

    now = utcnow()
    doc = {
        "id": new_id(),
        "order_id": order_id,
        "return_id": body.return_id,
        "cancellation_id": body.cancellation_id,
        "amount_inr": round(float(default_amount), 2),
        "reason": body.reason,
        "status": "completed" if body.payout_reference else "processing",
        "payout_reference": body.payout_reference,
        "notes": body.notes,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"],
    }
    await db.refund_transactions.insert_one(doc)
    doc.pop("_id", None)

    # Update associated order payment_status
    if doc["status"] == "completed" and order_id:
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"payment_status": "refunded", "updated_at": now}},
        )

    # If linked to a return, auto-move return to `refunded` state
    if body.return_id and doc["status"] == "completed":
        await db.return_requests.update_one(
            {"id": body.return_id},
            {"$set": {"status": "refunded", "updated_at": now},
             "$push": {"status_history": {"status": "refunded", "at": now, "by": current_user["id"], "note": "Refund issued"}}},
        )
        if linked_return:
            await _reverse_seller_earnings(db, linked_return)

    await log_event(current_user, "refund.issue", "refund", doc["id"], {"amount": doc["amount_inr"], "order_id": order_id})
    return doc


@router.get("/refunds")
async def list_refunds(
    status: str | None = None,
    order_id: str | None = None,
    limit: int = Query(200, le=500),
    _: dict = Depends(require_permission("payments.view", "payments.refund", "returns.view")),
):
    db = get_db()
    filt: dict = {}
    if status: filt["status"] = status
    if order_id: filt["order_id"] = order_id
    cursor = db.refund_transactions.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    return {"items": items, "total": await db.refund_transactions.count_documents(filt)}


@router.get("/returns-summary")
async def returns_summary(_: dict = Depends(require_permission("returns.view"))):
    """Dashboard KPIs for the returns/refunds admin page."""
    db = get_db()
    total_returns = await db.return_requests.count_documents({})
    pending_returns = await db.return_requests.count_documents({"status": {"$in": ["requested", "approved", "pickup_scheduled", "picked_up"]}})
    completed_returns = await db.return_requests.count_documents({"status": {"$in": ["refunded", "closed"]}})
    total_cancels = await db.cancellation_requests.count_documents({})
    total_refunds = await db.refund_transactions.count_documents({})

    refund_agg = await db.refund_transactions.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount_inr"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    total_refund_amount = round(refund_agg[0]["total"], 2) if refund_agg else 0

    return {
        "total_returns": total_returns,
        "pending_returns": pending_returns,
        "completed_returns": completed_returns,
        "total_cancellations": total_cancels,
        "total_refunds": total_refunds,
        "total_refund_amount": total_refund_amount,
    }
