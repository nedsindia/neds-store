"""Seed initial Super Admin, default business rules, and demo categories.
Idempotent — safe to run on every startup.
"""
import logging

from auth import ROLE_SUPER_ADMIN, hash_password
from db import get_db
from models import new_id, utcnow

logger = logging.getLogger("neds.seed")

DEFAULT_RULES = {
    "id": "default",
    # Legacy / general
    "commission_percent": 10.0,
    "delivery_radius_km": 5.0,
    "delivery_charge": 30.0,
    "free_delivery_above": 499.0,
    "min_order_amount": 99.0,
    "verification_radius_meters": 200.0,
    "platform_name": "NEDS STORE",
    "support_mobile": "9999999999",
    "currency": "INR",
    "locale": "en-IN",
    # Enterprise Delivery Charge Engine (Point 1)
    "minimum_delivery_distance_km": 2.0,
    "minimum_delivery_charge": 20.0,
    "per_km_charge": 7.0,
    "maximum_delivery_radius_km": 15.0,
    "free_delivery_threshold": 1000.0,
    "is_free_delivery_enabled": True,
    "weight_charge_rules": [
        {"min_kg": 0.0, "max_kg": 5.0, "charge": 0.0},
        {"min_kg": 5.0, "max_kg": 10.0, "charge": 20.0},
        {"min_kg": 10.0, "max_kg": 20.0, "charge": 50.0},
        {"min_kg": 20.0, "max_kg": None, "charge": 100.0},
    ],
    "default_seller_lat": 12.9716,
    "default_seller_lng": 77.5946,
    # Enterprise Payment Configuration (Point 2)
    "cod_enabled": True,
    "cod_limit": 5000.0,
    "upi_intent_enabled": True,
    "phonepe_enabled": True,
    # Enterprise Rider Payment Model (Point 4)
    "rider_payment_model": "hybrid",
    "rider_base_pay": 20.0,
    "rider_per_km_pay": 5.0,
    "rider_bonus_per_delivery_after": 15,
    "rider_bonus_amount": 50.0,
    "rider_monthly_salary": 15000.0,
    # Enterprise Tax / GST (Point 18)
    "gst_enabled": True,
    "default_gst_percentage": 18.0,
    "company_gst_number": "",
    "company_pan": "",
    "company_address": "",
    "company_state": "",
    "company_state_code": "",
}

SEED_CATEGORIES = [
    {"name": "Groceries", "icon": "shopping-cart", "min_commission": 5.0, "max_commission": 25.0},
    {"name": "Fruits & Vegetables", "icon": "apple", "min_commission": 5.0, "max_commission": 20.0},
    {"name": "Dairy & Breakfast", "icon": "coffee", "min_commission": 5.0, "max_commission": 20.0},
    {"name": "Snacks & Beverages", "icon": "package", "min_commission": 8.0, "max_commission": 25.0},
    {"name": "Personal Care", "icon": "heart", "min_commission": 10.0, "max_commission": 30.0},
    {"name": "Household", "icon": "home", "min_commission": 8.0, "max_commission": 25.0},
]


async def seed_super_admin():
    db = get_db()
    existing = await db.users.find_one({"mobile": "9999999999"})
    if existing:
        # Ensure it's active and role is super_admin (idempotent)
        await db.users.update_one(
            {"mobile": "9999999999"},
            {"$set": {"role": ROLE_SUPER_ADMIN, "active": True}},
        )
        logger.info("Super Admin already exists — verified")
        return
    doc = {
        "id": new_id(),
        "name": "Super Admin",
        "mobile": "9999999999",
        "password_hash": hash_password("Admin@123"),
        "role": ROLE_SUPER_ADMIN,
        "email": "admin@nedsstore.app",
        "address": None,
        "active": True,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    await db.users.insert_one(doc)
    logger.info("Seeded Super Admin: mobile=9999999999")


async def seed_rules():
    db = get_db()
    existing = await db.business_rules.find_one({"id": "default"})
    if existing:
        # Backfill any newly-added delivery-engine keys onto pre-existing rules doc
        updates = {}
        for k, v in DEFAULT_RULES.items():
            if k == "id":
                continue
            if k not in existing:
                updates[k] = v
        if updates:
            updates["updated_at"] = utcnow()
            await db.business_rules.update_one({"id": "default"}, {"$set": updates})
            logger.info(f"Backfilled business_rules with {list(updates.keys())}")
        return
    rules = DEFAULT_RULES.copy()
    rules["created_at"] = utcnow()
    rules["updated_at"] = utcnow()
    await db.business_rules.insert_one(rules)
    logger.info("Seeded default business rules")


async def seed_categories():
    db = get_db()
    if await db.categories.count_documents({}) > 0:
        # Backfill min/max commission for existing categories that pre-date the module
        await db.categories.update_many(
            {"min_commission": {"$exists": False}},
            {"$set": {"min_commission": 5.0, "max_commission": 20.0, "updated_at": utcnow()}},
        )
        return
    docs = []
    for c in SEED_CATEGORIES:
        docs.append({
            "id": new_id(),
            "name": c["name"],
            "description": None,
            "icon": c["icon"],
            "active": True,
            "min_commission": c["min_commission"],
            "max_commission": c["max_commission"],
            "created_at": utcnow(),
            "updated_at": utcnow(),
        })
    await db.categories.insert_many(docs)
    logger.info(f"Seeded {len(docs)} categories")


async def backfill_products():
    """Give any pre-existing product without commission_percentage the category
    minimum commission — keeps them valid under the new rules. Also default
    weight_kg / is_bulky / bulky_charge for the Delivery Engine."""
    db = get_db()
    cats: dict = {}
    async for c in db.categories.find({}, {"_id": 0, "id": 1, "min_commission": 1}):
        cats[c["id"]] = c.get("min_commission", 5.0)
    async for p in db.products.find({"commission_percentage": {"$exists": False}}, {"_id": 0, "id": 1, "category_id": 1}):
        default = cats.get(p.get("category_id"), 5.0)
        await db.products.update_one({"id": p["id"]}, {"$set": {"commission_percentage": default, "updated_at": utcnow()}})
    # Delivery-engine backfill — these are additive, safe defaults
    await db.products.update_many(
        {"weight_kg": {"$exists": False}},
        {"$set": {"weight_kg": 0.0, "is_bulky": False, "bulky_charge": 0.0}},
    )


async def seed_payment_accounts():
    """Seed payment accounts only in development. In production, admin adds real accounts via UI.
    Idempotent — skipped if any account already exists.

    To enable demo seed, set env NEDS_SEED_DEMO_PAYMENTS=1.
    """
    import os
    db = get_db()
    if await db.payment_accounts.count_documents({}) > 0:
        # Enforce single-primary invariant across all account types on existing data
        primaries = await db.payment_accounts.find({"is_primary": True}, {"_id": 0, "id": 1, "created_at": 1}).sort("created_at", 1).to_list(50)
        if len(primaries) > 1:
            # Keep the oldest one, demote the rest
            keep_id = primaries[0]["id"]
            for p in primaries[1:]:
                await db.payment_accounts.update_one({"id": p["id"]}, {"$set": {"is_primary": False, "updated_at": utcnow()}})
            logger.info(f"Fixed multi-primary payment_accounts — kept {keep_id}, demoted {len(primaries)-1} others")
        return

    if os.environ.get("NEDS_SEED_DEMO_PAYMENTS") != "1":
        logger.info("payment_accounts empty and NEDS_SEED_DEMO_PAYMENTS!=1 — skipping demo seed")
        return

    now = utcnow()
    await db.payment_accounts.insert_many([
        {
            "id": new_id(),
            "type": "upi",
            "holder_name": "NEDS STORE PVT LTD",
            "bank_name": None,
            "account_number": None,
            "ifsc": None,
            "upi_id": "demo@upi",
            "label": "Demo UPI",
            "is_primary": True,
            "active": True,
            "created_at": now,
            "updated_at": now,
        },
    ])
    logger.info("Seeded 1 demo payment account (dev mode)")


async def seed_roles():
    """Idempotently seed system roles from rbac.SYSTEM_ROLES.
    Existing role docs get their `permissions` refreshed to reflect any newly-added catalog keys,
    but ONLY for system roles that haven't been customized (system: True).
    Custom roles created via API are never touched.
    """
    from rbac import SYSTEM_ROLES
    db = get_db()
    now = utcnow()
    for role_id, spec in SYSTEM_ROLES.items():
        existing = await db.roles.find_one({"id": role_id})
        if not existing:
            await db.roles.insert_one({
                "id": role_id,
                "name": spec["name"],
                "description": spec["description"],
                "permissions": spec["permissions"],
                "system": True,
                "created_at": now,
                "updated_at": now,
            })
        elif existing.get("system"):
            # Refresh permissions for system roles so newly-added catalog keys apply
            await db.roles.update_one(
                {"id": role_id},
                {"$set": {
                    "name": spec["name"],
                    "description": spec["description"],
                    "permissions": spec["permissions"],
                    "system": True,
                    "updated_at": now,
                }},
            )
    logger.info("Seeded system roles")


async def seed_all():
    await seed_super_admin()
    await seed_rules()
    await seed_categories()
    await backfill_products()
    await seed_payment_accounts()
    await seed_roles()
