"""Pydantic models for API request/response."""
from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field, field_validator
import uuid


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Auth ----------
class LoginRequest(BaseModel):
    mobile: str
    password: str

    @field_validator("mobile")
    @classmethod
    def _mobile(cls, v: str) -> str:
        v = v.strip()
        if len(v) != 10 or not v.isdigit():
            raise ValueError("Mobile must be a 10-digit number")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ---------- Users ----------
class UserCreate(BaseModel):
    name: str
    mobile: str
    password: str
    role: str  # super_admin | manager | staff_admin | customer | seller | rider | staff
    email: str | None = None
    address: str | None = None
    address_lat: float | None = None
    address_lng: float | None = None
    active: bool = True

    @field_validator("mobile")
    @classmethod
    def _mobile(cls, v: str) -> str:
        v = v.strip()
        if len(v) != 10 or not v.isdigit():
            raise ValueError("Mobile must be a 10-digit number")
        return v


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    address: str | None = None
    address_lat: float | None = None
    address_lng: float | None = None
    role: str | None = None
    active: bool | None = None
    password: str | None = None


class UserPublic(BaseModel):
    id: str
    name: str
    mobile: str
    role: str
    email: str | None = None
    address: str | None = None
    active: bool = True
    created_at: datetime


# ---------- Categories ----------
class CategoryCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    active: bool = True
    min_commission: float = 5.0
    max_commission: float = 20.0

    @field_validator("min_commission", "max_commission")
    @classmethod
    def _pct(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("Commission must be between 0 and 100")
        return v


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    active: bool | None = None
    min_commission: float | None = None
    max_commission: float | None = None


# ---------- Products ----------
class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    category_id: str
    seller_id: str | None = None  # if None, set from current user (seller)
    price: float
    mrp: float | None = None
    stock: int = 0
    unit: str = "pc"  # pc, kg, ltr, g, ml
    image_base64: str | None = None
    active: bool = True
    commission_percentage: float  # required — must fall within category min/max
    # Delivery-engine per-product fields
    weight_kg: float = 0.0
    is_bulky: bool = False
    bulky_charge: float = 0.0


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category_id: str | None = None
    price: float | None = None
    mrp: float | None = None
    stock: int | None = None
    unit: str | None = None
    image_base64: str | None = None
    active: bool | None = None
    commission_percentage: float | None = None
    weight_kg: float | None = None
    is_bulky: bool | None = None
    bulky_charge: float | None = None


# ---------- Orders ----------
class OrderItem(BaseModel):
    product_id: str
    # Legacy client fields are accepted for backward compatibility but are never authoritative.
    name: str | None = None
    price: float | None = None
    qty: int = Field(..., gt=0, le=1000)
    seller_id: str | None = None


class OrderCreate(BaseModel):
    customer_id: str | None = None  # ignored for CUSTOMER; server uses current_user identity
    items: list[OrderItem] = Field(..., min_length=1, max_length=100)
    delivery_address: str
    delivery_lat: float
    delivery_lng: float
    payment_method: str = "cod"  # cod | upi | phonepe
    notes: str | None = None

    @field_validator("payment_method")
    @classmethod
    def _payment_method(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"cod", "upi", "phonepe"}:
            raise ValueError("Unsupported payment method")
        return v


class OrderStatusUpdate(BaseModel):
    status: str  # placed | accepted | packed | out_for_delivery | delivered | cancelled


# ---------- Deliveries ----------
class RiderLocationUpdate(BaseModel):
    lat: float
    lng: float


class DeliveryAssign(BaseModel):
    rider_id: str


class DeliveryVerify(BaseModel):
    code: str
    rider_lat: float
    rider_lng: float


# ---------- Business Rules ----------
class WeightSlab(BaseModel):
    min_kg: float
    max_kg: float | None = None  # None = open-ended (last slab)
    charge: float


class BusinessRulesUpdate(BaseModel):
    # legacy / general
    commission_percent: float | None = None
    delivery_radius_km: float | None = None
    delivery_charge: float | None = None
    free_delivery_above: float | None = None
    min_order_amount: float | None = None
    verification_radius_meters: float | None = None
    platform_name: str | None = None
    support_mobile: str | None = None

    # Enterprise Delivery Charge Engine
    minimum_delivery_distance_km: float | None = None
    minimum_delivery_charge: float | None = None
    per_km_charge: float | None = None
    maximum_delivery_radius_km: float | None = None
    free_delivery_threshold: float | None = None
    is_free_delivery_enabled: bool | None = None
    weight_charge_rules: list[WeightSlab] | None = None
    default_seller_lat: float | None = None
    default_seller_lng: float | None = None

    # Enterprise Payment Configuration (Point 2)
    cod_enabled: bool | None = None
    cod_limit: float | None = None
    upi_intent_enabled: bool | None = None
    phonepe_enabled: bool | None = None

    # Enterprise Rider Payment Model (Point 4)
    rider_payment_model: str | None = None  # per_delivery | per_km | hybrid | salary
    rider_base_pay: float | None = None
    rider_per_km_pay: float | None = None
    rider_bonus_per_delivery_after: int | None = None  # trigger after N deliveries in a day
    rider_bonus_amount: float | None = None
    rider_monthly_salary: float | None = None  # for salary model

    # Enterprise Tax / GST (Point 18)
    gst_enabled: bool | None = None
    default_gst_percentage: float | None = None
    company_gst_number: str | None = None
    company_pan: str | None = None
    company_address: str | None = None
    company_state: str | None = None
    company_state_code: str | None = None


# ---------- Payment Accounts (Point 2) ----------
class PaymentAccountCreate(BaseModel):
    type: str  # bank | upi
    holder_name: str
    # For bank accounts
    bank_name: str | None = None
    account_number: str | None = None
    ifsc: str | None = None
    # For UPI
    upi_id: str | None = None
    # Common
    label: str | None = None
    is_primary: bool = False
    active: bool = True


class PaymentAccountUpdate(BaseModel):
    holder_name: str | None = None
    bank_name: str | None = None
    account_number: str | None = None
    ifsc: str | None = None
    upi_id: str | None = None
    label: str | None = None
    is_primary: bool | None = None
    active: bool | None = None


# ---------- PhonePe Gateway (Point 24) ----------
class PhonePeCreateOrderRequest(BaseModel):
    order_id: str | None = None  # Link to a NEDS order (optional; auto-created if not supplied)
    amount_inr: float
    customer_id: str | None = None
    phone_number: str | None = None
    idempotency_key: str
    meta: dict | None = None
    redirect_url: str | None = None  # where PhonePe should redirect after payment


# ---------- Settlement Engine (Points 3 & 4) ----------
class SettlementCreate(BaseModel):
    entity_id: str  # seller_id or rider_id
    period_start: str | None = None  # ISO date; if None, "all pending"
    period_end: str | None = None
    payout_method: str | None = None  # bank | upi
    payout_reference: str | None = None
    notes: str | None = None


class SettlementMarkPaid(BaseModel):
    payout_reference: str | None = None
    notes: str | None = None


class RefundRequest(BaseModel):
    amount_inr: float | None = None  # None = full refund
    reason: str | None = None


# ---------- Checkout preview ----------
class CheckoutPreviewItem(BaseModel):
    product_id: str
    qty: int = Field(1, gt=0, le=1000)


class CheckoutPreviewRequest(BaseModel):
    items: list[CheckoutPreviewItem] = Field(..., min_length=1, max_length=100)
    customer_lat: float
    customer_lng: float
    seller_lat: float | None = None
    seller_lng: float | None = None
    # Deprecated client subtotal retained only for request compatibility; backend must recompute it.
    order_subtotal: float | None = None
