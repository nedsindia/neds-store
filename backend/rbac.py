"""Enterprise RBAC (Point 10) — Permission catalog, role→permission map, permission checks.

Permissions are simple strings shaped as `<resource>.<action>` (e.g. `orders.view`, `products.create`).
Roles are stored in a `roles` collection and can be assigned granular permissions.
System roles (super_admin, manager, staff_admin, customer, seller, rider, staff) are seeded and cannot be deleted.
Individual users can also have extra permissions via `users.extra_permissions` array (union with role perms).
"""
from typing import Annotated
from fastapi import Depends, HTTPException

from auth import ROLE_SUPER_ADMIN, get_current_user
from db import get_db


# ---------- Permission Catalog ----------
# Grouped by module for easy display in Admin UI matrix
PERMISSION_CATALOG: dict[str, list[dict]] = {
    "Dashboard": [
        {"key": "dashboard.view", "label": "View Dashboard"},
    ],
    "Orders": [
        {"key": "orders.view", "label": "View Orders"},
        {"key": "orders.update_status", "label": "Update Order Status"},
        {"key": "orders.cancel", "label": "Cancel Orders"},
    ],
    "Deliveries": [
        {"key": "deliveries.view", "label": "View Deliveries"},
        {"key": "deliveries.assign", "label": "Assign Rider"},
        {"key": "deliveries.verify", "label": "Verify Delivery"},
    ],
    "Users": [
        {"key": "users.view", "label": "View Users"},
        {"key": "users.create", "label": "Create Users"},
        {"key": "users.update", "label": "Update Users"},
        {"key": "users.delete", "label": "Delete Users"},
    ],
    "Products": [
        {"key": "products.view", "label": "View Products"},
        {"key": "products.create", "label": "Create Products"},
        {"key": "products.update", "label": "Update Products"},
        {"key": "products.delete", "label": "Delete Products"},
    ],
    "Categories": [
        {"key": "categories.view", "label": "View Categories"},
        {"key": "categories.manage", "label": "Manage Categories"},
    ],
    "Inventory": [
        {"key": "inventory.view", "label": "View Inventory"},
        {"key": "inventory.adjust", "label": "Adjust Stock"},
        {"key": "inventory.movements.view", "label": "View Stock Movements"},
    ],
    "Payments": [
        {"key": "payments.view", "label": "View Payments"},
        {"key": "payments.config", "label": "Manage Payment Config"},
        {"key": "payments.refund", "label": "Issue Refunds"},
    ],
    "Settlements": [
        {"key": "settlements.view", "label": "View Settlements"},
        {"key": "settlements.approve", "label": "Approve Settlements"},
        {"key": "settlements.mark_paid", "label": "Mark Settlements Paid"},
    ],
    "Returns & Refunds": [
        {"key": "returns.view", "label": "View Return Requests"},
        {"key": "returns.manage", "label": "Approve / Reject Returns"},
    ],
    "Invoices": [
        {"key": "invoices.view", "label": "View Invoices"},
        {"key": "invoices.regenerate", "label": "Regenerate Invoices"},
    ],
    "Coupons & Promotions": [
        {"key": "coupons.view", "label": "View Coupons"},
        {"key": "coupons.manage", "label": "Create / Edit Coupons"},
    ],
    "Staff": [
        {"key": "staff.view", "label": "View Staff"},
        {"key": "staff.manage", "label": "Create / Edit Staff"},
        {"key": "staff.salary", "label": "Manage Staff Salary"},
    ],
    "Business Rules": [
        {"key": "rules.view", "label": "View Business Rules"},
        {"key": "rules.update", "label": "Update Business Rules"},
    ],
    "RBAC": [
        {"key": "rbac.view", "label": "View Roles & Permissions"},
        {"key": "rbac.manage", "label": "Manage Roles & Permissions"},
    ],
    "Audit": [
        {"key": "audit.view", "label": "View Audit Logs"},
    ],
    "Reports": [
        {"key": "reports.view", "label": "View Reports"},
    ],
}


def all_permission_keys() -> list[str]:
    keys: list[str] = []
    for _, items in PERMISSION_CATALOG.items():
        keys.extend([i["key"] for i in items])
    return keys


# ---------- System roles ----------
SYSTEM_ROLES: dict[str, dict] = {
    "super_admin": {
        "name": "Super Admin",
        "description": "Full unrestricted access to all modules.",
        "system": True,
        "permissions": ["*"],  # wildcard = all
    },
    "manager": {
        "name": "Manager",
        "description": "Operational manager with broad read/write access, except RBAC and sensitive config.",
        "system": True,
        "permissions": [
            "dashboard.view",
            "orders.view", "orders.update_status", "orders.cancel",
            "deliveries.view", "deliveries.assign",
            "users.view", "users.create", "users.update",
            "products.view", "products.create", "products.update",
            "categories.view", "categories.manage",
            "inventory.view", "inventory.adjust", "inventory.movements.view",
            "payments.view", "payments.refund",
            "settlements.view", "settlements.approve", "settlements.mark_paid",
            "returns.view", "returns.manage",
            "invoices.view", "invoices.regenerate",
            "coupons.view", "coupons.manage",
            "staff.view",
            "rules.view",
            "audit.view",
            "reports.view",
        ],
    },
    "staff_admin": {
        "name": "Staff Admin",
        "description": "Limited admin — day-to-day operations only.",
        "system": True,
        "permissions": [
            "dashboard.view",
            "orders.view", "orders.update_status",
            "deliveries.view",
            "users.view",
            "products.view",
            "inventory.view",
            "returns.view",
            "invoices.view",
            "reports.view",
        ],
    },
    "staff": {
        "name": "Staff",
        "description": "Support/warehouse staff. Assigned via Staff Management module.",
        "system": True,
        "permissions": [
            "orders.view",
            "deliveries.view",
            "returns.view",
        ],
    },
    "seller": {"name": "Seller", "description": "Marketplace vendor.", "system": True, "permissions": []},
    "rider": {"name": "Rider", "description": "Delivery partner.", "system": True, "permissions": []},
    "customer": {"name": "Customer", "description": "End user.", "system": True, "permissions": []},
}


# ---------- Permission checks ----------
async def get_effective_permissions(user: dict) -> set[str]:
    """Return the effective permission set for a user:
    role permissions ∪ user.extra_permissions. Super Admin returns {"*"} sentinel.
    """
    role = user.get("role")
    if role == ROLE_SUPER_ADMIN:
        return {"*"}
    db = get_db()
    role_doc = await db.roles.find_one({"id": role}, {"_id": 0, "permissions": 1})
    perms: set[str] = set(role_doc.get("permissions", []) if role_doc else [])
    # Fallback to system role defaults if collection is empty (before seed runs)
    if not perms and role in SYSTEM_ROLES:
        perms = set(SYSTEM_ROLES[role]["permissions"])
    perms.update(user.get("extra_permissions", []) or [])
    return perms


def has_permission(perms: set[str], required: str) -> bool:
    if "*" in perms:
        return True
    if required in perms:
        return True
    # Wildcard by resource, e.g. "orders.*"
    prefix = required.split(".")[0] + ".*"
    return prefix in perms


def require_permission(*required: str):
    """FastAPI dependency factory: any of the listed permissions suffices."""
    async def dep(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
        perms = await get_effective_permissions(current_user)
        for r in required:
            if has_permission(perms, r):
                return current_user
        raise HTTPException(
            status_code=403,
            detail=f"Missing required permission: {' or '.join(required)}",
        )
    return dep
