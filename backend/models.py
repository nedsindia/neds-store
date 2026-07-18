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


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    active: bool | None = None


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


# ---------- Orders ----------
class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    qty: int
    seller_id: str | None = None


class OrderCreate(BaseModel):
    customer_id: str | None = None  # server sets from current_user for customer
    items: list[OrderItem]
    delivery_address: str
    delivery_lat: float
    delivery_lng: float
    payment_method: str = "cod"  # cod | upi
    notes: str | None = None


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
class BusinessRulesUpdate(BaseModel):
    commission_percent: float | None = None
    delivery_radius_km: float | None = None
    delivery_charge: float | None = None
    free_delivery_above: float | None = None
    min_order_amount: float | None = None
    verification_radius_meters: float | None = None
    platform_name: str | None = None
    support_mobile: str | None = None
