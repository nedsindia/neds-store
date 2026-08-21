"""Enterprise Staff Management (Point 6).
Staff are users with role in {staff, staff_admin, manager}. Extra fields stored on user doc.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import log_event
from auth import hash_password
from db import get_db
from models import new_id, utcnow
from rbac import require_permission

router = APIRouter(tags=["staff"])

STAFF_ROLES = {"staff", "staff_admin", "manager"}


class StaffCreate(BaseModel):
    name: str
    mobile: str = Field(min_length=10, max_length=10)
    password: str
    email: str | None = None
    role: str = "staff"  # staff | staff_admin | manager
    designation: str | None = None
    department: str | None = None
    monthly_salary: float = 0.0
    joining_date: datetime | None = None
    active: bool = True


class StaffUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None
    designation: str | None = None
    department: str | None = None
    monthly_salary: float | None = None
    active: bool | None = None
    password: str | None = None


@router.get("/staff")
async def list_staff(active: bool | None = None, _: dict = Depends(require_permission("staff.view"))):
    db = get_db()
    filt: dict = {"role": {"$in": list(STAFF_ROLES)}}
    if active is not None:
        filt["active"] = active
    cursor = db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(500)
    items = await cursor.to_list(500)
    return {"items": items, "total": await db.users.count_documents(filt)}


@router.post("/staff", status_code=201)
async def create_staff(body: StaffCreate, current_user: dict = Depends(require_permission("staff.manage"))):
    if body.role not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {STAFF_ROLES}")
    if not body.mobile.isdigit() or len(body.mobile) != 10:
        raise HTTPException(status_code=400, detail="Mobile must be 10 digits")
    db = get_db()
    if await db.users.find_one({"mobile": body.mobile}):
        raise HTTPException(status_code=400, detail="Mobile already registered")

    now = utcnow()
    doc = {
        "id": new_id(),
        "name": body.name,
        "mobile": body.mobile,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "email": body.email,
        "designation": body.designation,
        "department": body.department,
        "monthly_salary": float(body.monthly_salary or 0),
        "joining_date": body.joining_date or now,
        "active": body.active,
        "created_at": now,
        "updated_at": now,
        "extra_permissions": [],
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    await log_event(current_user, "staff.create", "user", doc["id"], {"role": body.role})
    return doc


@router.patch("/staff/{user_id}")
async def update_staff(user_id: str, body: StaffUpdate, current_user: dict = Depends(require_permission("staff.manage"))):
    db = get_db()
    user = await db.users.find_one({"id": user_id, "role": {"$in": list(STAFF_ROLES)}})
    if not user:
        raise HTTPException(status_code=404, detail="Staff member not found")
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "role" in updates and updates["role"] not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    updates["updated_at"] = utcnow()
    await db.users.update_one({"id": user_id}, {"$set": updates})
    await log_event(current_user, "staff.update", "user", user_id, {"fields": list(updates.keys())})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@router.post("/staff/{user_id}/salary/pay")
async def pay_staff_salary(
    user_id: str,
    reference: str | None = None,
    period: str | None = None,  # "YYYY-MM"
    current_user: dict = Depends(require_permission("staff.salary")),
):
    """Record a salary payment against a staff member (simple ledger entry)."""
    db = get_db()
    user = await db.users.find_one({"id": user_id, "role": {"$in": list(STAFF_ROLES)}}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Staff member not found")
    amount = float(user.get("monthly_salary") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="This staff member has no salary configured")
    now = utcnow()
    period = period or now.strftime("%Y-%m")
    # Idempotent by (user, period)
    existing = await db.staff_salaries.find_one({"user_id": user_id, "period": period})
    if existing:
        raise HTTPException(status_code=400, detail=f"Salary for {period} is already recorded")
    doc = {
        "id": new_id(),
        "user_id": user_id,
        "amount": amount,
        "period": period,
        "reference": reference,
        "paid_at": now,
        "paid_by": current_user["id"],
        "status": "paid",
    }
    await db.staff_salaries.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "staff.salary_paid", "user", user_id, {"amount": amount, "period": period})
    return doc


@router.get("/staff/{user_id}/salary-history")
async def salary_history(user_id: str, _: dict = Depends(require_permission("staff.view"))):
    db = get_db()
    items = await db.staff_salaries.find({"user_id": user_id}, {"_id": 0}).sort("paid_at", -1).to_list(200)
    return {"items": items}
