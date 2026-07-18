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
}

SEED_CATEGORIES = [
    {"name": "Groceries", "icon": "shopping-cart"},
    {"name": "Fruits & Vegetables", "icon": "apple"},
    {"name": "Dairy & Breakfast", "icon": "coffee"},
    {"name": "Snacks & Beverages", "icon": "package"},
    {"name": "Personal Care", "icon": "heart"},
    {"name": "Household", "icon": "home"},
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
        return
    rules = DEFAULT_RULES.copy()
    rules["created_at"] = utcnow()
    rules["updated_at"] = utcnow()
    await db.business_rules.insert_one(rules)
    logger.info("Seeded default business rules")


async def seed_categories():
    db = get_db()
    if await db.categories.count_documents({}) > 0:
        return
    docs = []
    for c in SEED_CATEGORIES:
        docs.append({
            "id": new_id(),
            "name": c["name"],
            "description": None,
            "icon": c["icon"],
            "active": True,
            "created_at": utcnow(),
            "updated_at": utcnow(),
        })
    await db.categories.insert_many(docs)
    logger.info(f"Seeded {len(docs)} categories")


async def seed_all():
    await seed_super_admin()
    await seed_rules()
    await seed_categories()
