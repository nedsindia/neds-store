"""Payment configuration & PhonePe gateway routes.

Combines:
- Point 2 — Enterprise Payment Configuration (multi bank/UPI accounts, primary switching)
- Point 24 — PhonePe Standard Checkout v2 integration (create-order, status, refund, webhook)

Placeholder mode: when PHONEPE_MERCHANT_ID is 'REPLACE_ME' the gateway returns
a synthetic checkout URL / status, so admin & customer UI work end-to-end
before real credentials are provisioned.
"""
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from audit import log_event
from auth import get_current_user, require_admin, require_roles, ROLE_SUPER_ADMIN
from db import get_db
from models import (
    PaymentAccountCreate,
    PaymentAccountUpdate,
    PhonePeCreateOrderRequest,
    RefundRequest,
    new_id,
    utcnow,
)
from phonepe_gateway import from_paise, gateway, is_placeholder, to_paise

router = APIRouter(tags=["payments"])


# ============================================================ PAYMENT ACCOUNTS (Point 2)
# Stricter UPI validation per NPCI/BHIM spec:
# handle 3-20 chars (letters/digits/., -, _), followed by @, then a valid PSP handle
_UPI_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,19}@[a-zA-Z][a-zA-Z0-9]{1,20}$")
_IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


def _mask_account_number(num: str | None) -> str | None:
    """XXXXXXXX1234 style masking for admin list views."""
    if not num:
        return num
    if len(num) <= 4:
        return num
    return "X" * (len(num) - 4) + num[-4:]


def _redact(doc: dict) -> dict:
    """Return an admin-list-safe copy of a payment_account doc."""
    if not doc:
        return doc
    out = {**doc}
    out.pop("_id", None)
    if out.get("type") == "bank":
        out["account_number_masked"] = _mask_account_number(out.get("account_number"))
        out["account_number"] = out["account_number_masked"]
    return out


def _validate_account(body: PaymentAccountCreate | PaymentAccountUpdate, is_create: bool = False):
    t = getattr(body, "type", None)
    if is_create and t not in ("bank", "upi"):
        raise HTTPException(status_code=400, detail="type must be 'bank' or 'upi'")
    if t == "bank":
        if is_create and not (body.account_number and body.ifsc and body.bank_name):
            raise HTTPException(status_code=400, detail="Bank account requires account_number, ifsc, bank_name")
        if body.ifsc and not _IFSC_RE.match(body.ifsc):
            raise HTTPException(status_code=400, detail="Invalid IFSC — must be 11 chars matching ^[A-Z]{4}0[A-Z0-9]{6}$")
        if body.account_number and not (6 <= len(body.account_number) <= 20 and body.account_number.isdigit()):
            raise HTTPException(status_code=400, detail="Bank account_number must be 6-20 digits")
    if t == "upi":
        if is_create and not body.upi_id:
            raise HTTPException(status_code=400, detail="UPI account requires upi_id")
        if body.upi_id and not _UPI_RE.match(body.upi_id):
            raise HTTPException(status_code=400, detail="Invalid UPI ID — expected format name@bank (e.g. rakesh@okicici, 9999999999@paytm)")


@router.get("/payment-accounts")
async def list_payment_accounts(
    type: str | None = None,
    active: bool | None = None,
    _: dict = Depends(require_admin),
):
    db = get_db()
    filt: dict = {}
    if type:
        filt["type"] = type
    if active is not None:
        filt["active"] = active
    items = await db.payment_accounts.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Admin list ALWAYS returns masked account numbers
    return {"items": [_redact(a) for a in items]}


@router.get("/payment-accounts/{acct_id}")
async def get_payment_account(acct_id: str, current_user: dict = Depends(require_admin)):
    """Detail endpoint returns the FULL account_number (needed by the Edit modal).
    Access is audit-logged so every full-view is traceable."""
    db = get_db()
    acct = await db.payment_accounts.find_one({"id": acct_id}, {"_id": 0})
    if not acct:
        raise HTTPException(status_code=404, detail="Payment account not found")
    await log_event(current_user, "payment_account.view_full", "payment_account", acct_id)
    return acct


@router.post("/payment-accounts", status_code=201)
async def create_payment_account(body: PaymentAccountCreate, current_user: dict = Depends(require_admin)):
    _validate_account(body, is_create=True)
    db = get_db()
    doc = {
        "id": new_id(),
        "type": body.type,
        "holder_name": body.holder_name,
        "bank_name": body.bank_name,
        "account_number": body.account_number,
        "ifsc": body.ifsc.upper() if body.ifsc else None,
        "upi_id": body.upi_id,
        "label": body.label,
        "is_primary": bool(body.is_primary),
        "active": body.active,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    # Only ONE primary payment account TOTAL (per user directive)
    if doc["is_primary"]:
        await db.payment_accounts.update_many({}, {"$set": {"is_primary": False, "updated_at": utcnow()}})
    await db.payment_accounts.insert_one(doc)
    await log_event(
        current_user, "payment_account.create", "payment_account", doc["id"],
        {"type": doc["type"], "label": doc.get("label"), "is_primary": doc["is_primary"]},
    )
    return _redact(doc)


@router.patch("/payment-accounts/{acct_id}")
async def update_payment_account(acct_id: str, body: PaymentAccountUpdate, current_user: dict = Depends(require_admin)):
    _validate_account(body)
    db = get_db()
    existing = await db.payment_accounts.find_one({"id": acct_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment account not found")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "ifsc" in updates and updates["ifsc"]:
        updates["ifsc"] = updates["ifsc"].upper()

    # Track transitions for granular audit events (enable/disable/set-primary)
    events: list[tuple[str, dict]] = []
    if "active" in updates and bool(updates["active"]) != bool(existing.get("active", True)):
        events.append(("payment_account.enable" if updates["active"] else "payment_account.disable", {}))
    if updates.get("is_primary"):
        # Only ONE primary across ALL payment accounts
        await db.payment_accounts.update_many(
            {"id": {"$ne": acct_id}},
            {"$set": {"is_primary": False, "updated_at": utcnow()}},
        )
        if not existing.get("is_primary"):
            events.append(("payment_account.set_primary", {}))

    updates["updated_at"] = utcnow()
    await db.payment_accounts.update_one({"id": acct_id}, {"$set": updates})

    # Always log the generic update (with the changed field list); plus any transition events above
    await log_event(current_user, "payment_account.update", "payment_account", acct_id, {"fields": list(updates.keys())})
    for act, meta in events:
        await log_event(current_user, act, "payment_account", acct_id, meta)

    return _redact(await db.payment_accounts.find_one({"id": acct_id}, {"_id": 0}))


@router.post("/payment-accounts/{acct_id}/set-primary")
async def set_primary_account(acct_id: str, current_user: dict = Depends(require_admin)):
    """Only ONE primary payment account is allowed across ALL types."""
    db = get_db()
    acct = await db.payment_accounts.find_one({"id": acct_id}, {"_id": 0})
    if not acct:
        raise HTTPException(status_code=404, detail="Payment account not found")
    if not acct.get("active", True):
        raise HTTPException(status_code=400, detail="Cannot make an inactive account primary — enable it first")
    await db.payment_accounts.update_many({}, {"$set": {"is_primary": False, "updated_at": utcnow()}})
    await db.payment_accounts.update_one({"id": acct_id}, {"$set": {"is_primary": True, "updated_at": utcnow()}})
    await log_event(current_user, "payment_account.set_primary", "payment_account", acct_id)
    return {"ok": True, "primary_id": acct_id}


@router.delete("/payment-accounts/{acct_id}")
async def deactivate_payment_account(acct_id: str, current_user: dict = Depends(require_admin)):
    db = get_db()
    result = await db.payment_accounts.update_one(
        {"id": acct_id},
        {"$set": {"active": False, "is_primary": False, "updated_at": utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment account not found")
    # Full-fledged audit: distinguish "delete" (soft) from "disable" so the log tells the story
    await log_event(current_user, "payment_account.delete", "payment_account", acct_id)
    return {"ok": True}


# ============================================================ PAYMENT METHOD CONFIG (customer-facing)
@router.get("/payment-methods")
async def public_payment_methods(_: dict = Depends(get_current_user)):
    """Returns the list of ENABLED payment methods and current COD limit — used by the
    customer app checkout screen to show only the methods enabled by the admin."""
    db = get_db()
    r = await db.business_rules.find_one({"id": "default"}, {"_id": 0}) or {}
    cod_enabled = bool(r.get("cod_enabled", True))
    upi_enabled = bool(r.get("upi_intent_enabled", True))
    phonepe_enabled = bool(r.get("phonepe_enabled", True))
    cod_limit = float(r.get("cod_limit", 5000) or 0)

    primary_upi = await db.payment_accounts.find_one(
        {"type": "upi", "is_primary": True, "active": True}, {"_id": 0, "upi_id": 1, "holder_name": 1, "label": 1},
    )

    methods: list[dict] = []
    if cod_enabled:
        methods.append({"id": "cod", "label": "Cash on Delivery", "enabled": True, "limit_inr": cod_limit})
    if upi_enabled and primary_upi:
        methods.append({"id": "upi", "label": "UPI Intent (GPay / PhonePe / Paytm)", "enabled": True, "upi_id": primary_upi.get("upi_id")})
    if phonepe_enabled:
        methods.append({"id": "phonepe", "label": "PhonePe Gateway", "enabled": True, "placeholder": is_placeholder()})

    return {"methods": methods, "cod_limit_inr": cod_limit, "phonepe_placeholder_mode": is_placeholder()}


# ============================================================ PHONEPE GATEWAY (Point 24)
@router.post("/payments/phonepe/create-order")
async def phonepe_create_order(body: PhonePeCreateOrderRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()

    # Refuse if PhonePe is disabled by the admin
    rules = await db.business_rules.find_one({"id": "default"}, {"_id": 0}) or {}
    if not rules.get("phonepe_enabled", True):
        raise HTTPException(status_code=400, detail="PhonePe payments are currently disabled by the admin")

    if body.amount_inr <= 0:
        raise HTTPException(status_code=400, detail="amount_inr must be greater than 0")

    # Idempotency
    existing = await db.payment_transactions.find_one(
        {"gateway": "phonepe", "idempotency_key": body.idempotency_key}, {"_id": 0},
    )
    if existing:
        return {
            "merchant_order_id": existing["merchant_order_id"],
            "checkout_url": existing.get("checkout_url"),
            "status": existing.get("status"),
            "idempotent_replay": True,
        }

    merchant_order_id = f"NEDS_{uuid4().hex[:20]}"
    redirect_url = body.redirect_url or f"neds://payments/return?order={merchant_order_id}"

    resp = await gateway.create_order(
        merchant_order_id=merchant_order_id,
        amount_paise=to_paise(body.amount_inr),
        redirect_url=redirect_url,
        meta_info=body.meta,
        phone_number=body.phone_number,
    )

    now = utcnow()
    doc = {
        "id": new_id(),
        "gateway": "phonepe",
        "merchant_order_id": merchant_order_id,
        "phonepe_order_id": resp.get("orderId"),
        "linked_order_id": body.order_id,
        "customer_id": body.customer_id or current_user["id"],
        "amount_paise": to_paise(body.amount_inr),
        "amount_inr": round(body.amount_inr, 2),
        "currency": "INR",
        "status": (resp.get("state") or "PENDING").upper(),
        "checkout_url": resp.get("redirectUrl"),
        "redirect_url": redirect_url,
        "idempotency_key": body.idempotency_key,
        "metadata": body.meta or {},
        "gateway_response": resp,
        "placeholder_mode": bool(resp.get("_placeholder")),
        "refunds": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.payment_transactions.insert_one(doc)
    doc.pop("_id", None)

    # Link back to the NEDS order document, if given
    if body.order_id:
        await db.orders.update_one(
            {"id": body.order_id},
            {"$set": {"payment_gateway": "phonepe", "payment_gateway_txn_id": doc["id"], "updated_at": now}},
        )

    await log_event(current_user, "payment.phonepe.create", "payment", doc["id"], {"amount_inr": body.amount_inr})
    return {
        "merchant_order_id": merchant_order_id,
        "checkout_url": doc["checkout_url"],
        "status": doc["status"],
        "placeholder_mode": doc["placeholder_mode"],
        "transaction_id": doc["id"],
    }


@router.get("/payments/phonepe/{merchant_order_id}/status")
async def phonepe_status(merchant_order_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    txn = await db.payment_transactions.find_one({"merchant_order_id": merchant_order_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Payment transaction not found")

    remote = await gateway.get_status(merchant_order_id)
    remote_state = (remote.get("state") or remote.get("payload", {}).get("state") or txn["status"]).upper()

    # In placeholder mode: auto-COMPLETE after ~5 s so the UI can flow
    if remote.get("_placeholder"):
        age = (datetime.now(timezone.utc) - txn["created_at"]).total_seconds()
        remote_state = "COMPLETED" if age > 5 else "PENDING"

    updates = {"status": remote_state, "gateway_response": remote, "updated_at": utcnow()}
    await db.payment_transactions.update_one({"merchant_order_id": merchant_order_id}, {"$set": updates})

    # Propagate success to the linked order
    if remote_state == "COMPLETED" and txn.get("linked_order_id"):
        await db.orders.update_one(
            {"id": txn["linked_order_id"]},
            {"$set": {"payment_status": "paid", "updated_at": utcnow()}},
        )

    return {"merchant_order_id": merchant_order_id, "status": remote_state, "placeholder_mode": bool(remote.get("_placeholder"))}


@router.post("/payments/phonepe/{merchant_order_id}/refund")
async def phonepe_refund(merchant_order_id: str, body: RefundRequest, current_user: dict = Depends(require_admin)):
    db = get_db()
    txn = await db.payment_transactions.find_one({"merchant_order_id": merchant_order_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    if txn.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail="Only COMPLETED payments can be refunded")

    amount_inr = float(body.amount_inr) if body.amount_inr is not None else from_paise(txn["amount_paise"])
    if amount_inr <= 0 or to_paise(amount_inr) > txn["amount_paise"]:
        raise HTTPException(status_code=400, detail="Refund amount must be > 0 and cannot exceed original payment amount")

    merchant_refund_id = f"NEDSRF_{uuid4().hex[:20]}"
    resp = await gateway.refund(
        merchant_refund_id=merchant_refund_id,
        merchant_order_id=merchant_order_id,
        amount_paise=to_paise(amount_inr),
    )
    refund_entry = {
        "merchant_refund_id": merchant_refund_id,
        "amount_paise": to_paise(amount_inr),
        "amount_inr": round(amount_inr, 2),
        "state": (resp.get("state") or "PENDING").upper(),
        "reason": body.reason,
        "gateway_response": resp,
        "created_at": utcnow(),
    }
    await db.payment_transactions.update_one(
        {"merchant_order_id": merchant_order_id},
        {"$push": {"refunds": refund_entry},
         "$set": {"latest_refund_status": refund_entry["state"], "updated_at": utcnow()}},
    )
    await log_event(current_user, "payment.phonepe.refund", "payment", txn["id"], {"amount_inr": amount_inr})
    return refund_entry


@router.post("/payments/phonepe/webhook")
async def phonepe_webhook(req: Request):
    """PhonePe pushes async payment/refund events here. Auth verified per docs."""
    body = await req.body()
    auth = req.headers.get("authorization", "")
    sig = req.headers.get("x-phonepe-checksum-signature") or req.headers.get("X-PhonePe-Checksum-Signature")

    # In placeholder mode, skip signature check (webhook won't fire anyway)
    if not is_placeholder() and not gateway.verify_webhook(auth, body, sig):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        data = await req.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = data.get("event") or ""
    payload = data.get("payload", {}) or {}
    state = (payload.get("state") or "").upper()
    db = get_db()

    if event.startswith("checkout.order."):
        moid = payload.get("merchantOrderId") or payload.get("merchant_order_id")
        if moid:
            await db.payment_transactions.update_one(
                {"merchant_order_id": moid},
                {"$set": {"status": state or "PENDING", "gateway_response": data, "updated_at": utcnow()}},
            )
            if state == "COMPLETED":
                txn = await db.payment_transactions.find_one({"merchant_order_id": moid}, {"_id": 0, "linked_order_id": 1})
                if txn and txn.get("linked_order_id"):
                    await db.orders.update_one(
                        {"id": txn["linked_order_id"]},
                        {"$set": {"payment_status": "paid", "updated_at": utcnow()}},
                    )
    elif event.startswith("pg.refund."):
        mrid = payload.get("merchantRefundId")
        if mrid:
            await db.payment_transactions.update_one(
                {"refunds.merchant_refund_id": mrid},
                {"$set": {"latest_refund_status": state, "updated_at": utcnow()}},
            )
    return {"ok": True}


@router.get("/payments/phonepe")
async def list_phonepe_txns(
    status: str | None = None,
    limit: int = Query(100, le=500),
    _: dict = Depends(require_admin),
):
    db = get_db()
    filt: dict = {"gateway": "phonepe"}
    if status:
        filt["status"] = status.upper()
    items = await db.payment_transactions.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    # Decorate with the user-approved public field names (Point 5)
    decorated = [
        {
            **t,
            "order_id": t.get("linked_order_id"),
            "transaction_id": t.get("id"),
            "amount": t.get("amount_inr"),
            "payment_method": t.get("gateway"),
            "payment_status": t.get("status"),
            "created_time": t.get("created_at"),
            "updated_time": t.get("updated_at"),
        }
        for t in items
    ]
    return {"items": decorated, "total": len(decorated)}
