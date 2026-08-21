"""RBAC routes — permissions catalog, roles CRUD, per-user extra permissions."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from audit import log_event
from auth import ROLE_SUPER_ADMIN, get_current_user
from db import get_db
from models import new_id, utcnow
from rbac import (
    PERMISSION_CATALOG,
    SYSTEM_ROLES,
    all_permission_keys,
    get_effective_permissions,
    require_permission,
)

router = APIRouter(tags=["rbac"], prefix="/rbac")


class RoleCreate(BaseModel):
    id: str  # slug, unique
    name: str
    description: str | None = None
    permissions: list[str] = []


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permissions: list[str] | None = None


class UserPermissionsUpdate(BaseModel):
    extra_permissions: list[str]


@router.get("/permissions")
async def list_permissions(_: dict = Depends(require_permission("rbac.view"))):
    """Return the permission catalog grouped by module."""
    return {"catalog": PERMISSION_CATALOG, "all_keys": all_permission_keys()}


@router.get("/roles")
async def list_roles(_: dict = Depends(require_permission("rbac.view"))):
    db = get_db()
    roles = await db.roles.find({}, {"_id": 0}).to_list(200)
    return {"items": roles}


@router.get("/roles/{role_id}")
async def get_role(role_id: str, _: dict = Depends(require_permission("rbac.view"))):
    db = get_db()
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.post("/roles", status_code=201)
async def create_role(body: RoleCreate, current_user: dict = Depends(require_permission("rbac.manage"))):
    db = get_db()
    if not body.id.replace("_", "").replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Role ID must be alphanumeric (underscores/hyphens allowed)")
    if await db.roles.find_one({"id": body.id}):
        raise HTTPException(status_code=400, detail="Role ID already exists")

    # Validate permissions
    valid_keys = set(all_permission_keys())
    invalid = [p for p in body.permissions if p not in valid_keys and p != "*"]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown permissions: {invalid}")

    doc = {
        "id": body.id,
        "name": body.name,
        "description": body.description,
        "permissions": body.permissions,
        "system": False,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    await db.roles.insert_one(doc)
    doc.pop("_id", None)
    await log_event(current_user, "rbac.role.create", "role", body.id, {"name": body.name})
    return doc


@router.patch("/roles/{role_id}")
async def update_role(role_id: str, body: RoleUpdate, current_user: dict = Depends(require_permission("rbac.manage"))):
    db = get_db()
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.get("system") and role_id == ROLE_SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="Super Admin role cannot be modified")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "permissions" in updates:
        valid_keys = set(all_permission_keys())
        invalid = [p for p in updates["permissions"] if p not in valid_keys and p != "*"]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Unknown permissions: {invalid}")

    updates["updated_at"] = utcnow()
    await db.roles.update_one({"id": role_id}, {"$set": updates})
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    await log_event(current_user, "rbac.role.update", "role", role_id, {"fields": list(updates.keys())})
    return role


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(require_permission("rbac.manage"))):
    db = get_db()
    role = await db.roles.find_one({"id": role_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.get("system"):
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")
    # Prevent delete if users are assigned to this role
    in_use = await db.users.count_documents({"role": role_id})
    if in_use:
        raise HTTPException(status_code=400, detail=f"Role in use by {in_use} user(s). Reassign users first.")
    await db.roles.delete_one({"id": role_id})
    await log_event(current_user, "rbac.role.delete", "role", role_id)
    return {"ok": True}


@router.get("/me")
async def my_permissions(current_user: dict = Depends(get_current_user)):
    """Current user's effective permissions — used by frontend to show/hide UI."""
    perms = await get_effective_permissions(current_user)
    return {
        "role": current_user.get("role"),
        "permissions": sorted(perms),
        "is_super_admin": current_user.get("role") == ROLE_SUPER_ADMIN,
    }


@router.patch("/users/{user_id}/permissions")
async def set_user_extra_permissions(
    user_id: str,
    body: UserPermissionsUpdate,
    current_user: dict = Depends(require_permission("rbac.manage")),
):
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    valid_keys = set(all_permission_keys())
    invalid = [p for p in body.extra_permissions if p not in valid_keys]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown permissions: {invalid}")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"extra_permissions": body.extra_permissions, "updated_at": utcnow()}},
    )
    await log_event(current_user, "rbac.user_perms", "user", user_id, {"count": len(body.extra_permissions)})
    return {"ok": True, "extra_permissions": body.extra_permissions}
