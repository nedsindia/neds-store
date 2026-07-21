"""User management routes."""
from fastapi import APIRouter, Depends, HTTPException, Query

from audit import log_event
from auth import (
    ALL_ROLES,
    ROLE_SUPER_ADMIN,
    get_current_user,
    hash_password,
    require_admin,
    require_roles,
)
from db import get_db
from models import UserCreate, UserUpdate, new_id, utcnow

router = APIRouter(prefix="/users", tags=["users"])


def _serialize(user: dict) -> dict:
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


@router.get("")
async def list_users(
    role: str | None = None,
    q: str | None = None,
    active: bool | None = None,
    limit: int = Query(100, le=500),
    skip: int = 0,
    _: dict = Depends(require_admin),
):
    db = get_db()
    filt: dict = {}
    if role:
        filt["role"] = role
    if active is not None:
        filt["active"] = active
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"mobile": {"$regex": q}},
        ]
    cursor = db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit)
    users = await cursor.to_list(limit)
    total = await db.users.count_documents(filt)
    return {"items": users, "total": total}


@router.post("", status_code=201)
async def create_user(body: UserCreate, current_user: dict = Depends(require_admin)):
    if body.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Allowed: {sorted(ALL_ROLES)}")
    # Only super admin can create admin-level users
    if body.role in {"super_admin", "manager", "staff_admin"} and current_user["role"] != ROLE_SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can create admin-level users")

    db = get_db()
    if await db.users.find_one({"mobile": body.mobile}):
        raise HTTPException(status_code=409, detail="Mobile number already registered")

    doc = {
        "id": new_id(),
        "name": body.name,
        "mobile": body.mobile,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "email": body.email,
        "address": body.address,
        "address_lat": body.address_lat,
        "address_lng": body.address_lng,
        "active": body.active,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    await db.users.insert_one(doc)
    await log_event(current_user, "user.create", "user", doc["id"], {"role": body.role, "mobile": body.mobile})
    return _serialize(doc)


@router.get("/{user_id}")
async def get_user(user_id: str, _: dict = Depends(require_admin)):
    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}")
async def update_user(user_id: str, body: UserUpdate, current_user: dict = Depends(require_admin)):
    db = get_db()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    if "role" in updates and updates["role"] not in ALL_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if "role" in updates and current_user["role"] != ROLE_SUPER_ADMIN and updates["role"] in {"super_admin", "manager", "staff_admin"}:
        raise HTTPException(status_code=403, detail="Only Super Admin can promote to admin roles")
    updates["updated_at"] = utcnow()
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_event(current_user, "user.update", "user", user_id, {"fields": list(updates.keys())})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@router.delete("/{user_id}")
async def deactivate_user(user_id: str, current_user: dict = Depends(require_roles())):
    # Super Admin only for hard delete → we do soft delete (deactivate) instead
    db = get_db()
    result = await db.users.update_one({"id": user_id}, {"$set": {"active": False, "updated_at": utcnow()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_event(current_user, "user.deactivate", "user", user_id)
    return {"ok": True}
