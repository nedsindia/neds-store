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
    minimum commission — keeps them valid under the new rules."""
    db = get_db()
    cats: dict = {}
    async for c in db.categories.find({}, {"_id": 0, "id": 1, "min_commission": 1}):
        cats[c["id"]] = c.get("min_commission", 5.0)
    async for p in db.products.find({"commission_percentage": {"$exists": False}}, {"_id": 0, "id": 1, "category_id": 1}):
        default = cats.get(p.get("category_id"), 5.0)
        await db.products.update_one({"id": p["id"]}, {"$set": {"commission_percentage": default, "updated_at": utcnow()}})


async def seed_all():
    await seed_super_admin()
    await seed_rules()
    await seed_categories()
    await backfill_products()
