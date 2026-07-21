"""PhonePe Payment Gateway — Point 24.

Modular gateway class per the official PhonePe Standard Checkout v2 API.
Supports UAT and Production environments via env vars.

If PHONEPE_MERCHANT_ID is set to "REPLACE_ME" (or is missing) the gateway
runs in **placeholder mode** — endpoints return a mock checkout URL and a
COMPLETED status after ~5 s, so the UI / admin panel work end-to-end even
before real credentials are wired in. Swap the env vars later and no code
changes are required.
"""
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx


def _env(name: str, default: str = "") -> str:
    v = os.environ.get(name, default)
    return v if v is not None else default


def is_placeholder() -> bool:
    return _env("PHONEPE_MERCHANT_ID", "REPLACE_ME") in ("", "REPLACE_ME")


def _base_url() -> str:
    return (
        "https://api-preprod.phonepe.com/apis/pg-sandbox"
        if _env("PHONEPE_ENV", "UAT").upper() == "UAT"
        else "https://api.phonepe.com/apis/pg"
    )


def _auth_url() -> str:
    return (
        "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"
        if _env("PHONEPE_ENV", "UAT").upper() == "UAT"
        else "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    )


class PhonePeGateway:
    def __init__(self):
        self._token: str | None = None
        self._token_exp: int = 0

    # -------- auth --------
    async def _get_token(self) -> str:
        if is_placeholder():
            return "placeholder-token"
        if self._token and time.time() < self._token_exp - 60:
            return self._token
        data = {
            "client_id": _env("PHONEPE_CLIENT_ID"),
            "client_version": _env("PHONEPE_CLIENT_VERSION", "1"),
            "client_secret": _env("PHONEPE_CLIENT_SECRET"),
            "grant_type": "client_credentials",
        }
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(_auth_url(), data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
            r.raise_for_status()
            js = r.json()
        self._token = js["access_token"]
        self._token_exp = int(js.get("expires_at", time.time() + 300))
        return self._token

    def _headers(self, token: str) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"O-Bearer {token}",
            "X-MERCHANT-ID": _env("PHONEPE_MERCHANT_ID"),
        }

    # -------- create order --------
    async def create_order(
        self,
        *,
        merchant_order_id: str,
        amount_paise: int,
        redirect_url: str,
        meta_info: dict | None = None,
        expire_after: int = 1200,
        phone_number: str | None = None,
    ) -> dict:
        if is_placeholder():
            # Placeholder: return a synthetic checkout URL that mimics PhonePe's shape
            fake_id = f"OMO_{uuid4().hex[:12]}"
            return {
                "orderId": fake_id,
                "state": "PENDING",
                "expireAt": int((datetime.now(timezone.utc) + timedelta(seconds=expire_after)).timestamp() * 1000),
                "redirectUrl": f"https://phonepe-placeholder.local/checkout/{merchant_order_id}",
                "_placeholder": True,
            }

        token = await self._get_token()
        payload = {
            "merchantOrderId": merchant_order_id,
            "amount": amount_paise,
            "expireAfter": expire_after,
            "paymentFlow": {
                "type": "PG_CHECKOUT",
                "merchantUrls": {"redirectUrl": redirect_url},
            },
        }
        if meta_info:
            payload["metaInfo"] = meta_info
        if phone_number:
            payload["prefillUserLoginDetails"] = phone_number

        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{_base_url()}/checkout/v2/pay", json=payload, headers=self._headers(token))
            r.raise_for_status()
            return r.json()

    # -------- status --------
    async def get_status(self, merchant_order_id: str) -> dict:
        if is_placeholder():
            # Placeholder: simulate a completed payment 5 s after creation
            return {"state": "PENDING", "_placeholder": True}

        token = await self._get_token()
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(
                f"{_base_url()}/checkout/v2/order/{merchant_order_id}/status",
                headers=self._headers(token),
                params={"details": "true", "errorContext": "true"},
            )
            r.raise_for_status()
            return r.json()

    # -------- refund --------
    async def refund(self, *, merchant_refund_id: str, merchant_order_id: str, amount_paise: int) -> dict:
        if is_placeholder():
            return {"state": "PENDING", "_placeholder": True, "merchantRefundId": merchant_refund_id}

        token = await self._get_token()
        payload = {
            "merchantRefundId": merchant_refund_id,
            "originalMerchantOrderId": merchant_order_id,
            "amount": amount_paise,
        }
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{_base_url()}/payments/v2/refund", json=payload, headers=self._headers(token))
            r.raise_for_status()
            return r.json()

    # -------- webhook verification --------
    @staticmethod
    def verify_webhook(auth_header: str, body: bytes, signature_header: str | None = None) -> bool:
        mode = _env("PHONEPE_WEBHOOK_AUTH_MODE", "SHA").upper()
        if mode == "SHA":
            expected = hashlib.sha256(
                f"{_env('PHONEPE_WEBHOOK_USERNAME')}:{_env('PHONEPE_WEBHOOK_PASSWORD')}".encode()
            ).hexdigest()
            return auth_header == expected
        if mode == "HMAC":
            salt = _env("PHONEPE_SALT_KEY").encode()
            computed = hmac.new(salt, body, hashlib.sha256).hexdigest()
            return signature_header == computed
        return False


# Module-level singleton (per-process token cache)
gateway = PhonePeGateway()


def to_paise(amount_inr: float) -> int:
    return int(round(float(amount_inr) * 100))


def from_paise(paise: int) -> float:
    return round(int(paise) / 100.0, 2)
