"""MongoDB connection module — single AsyncIOMotorClient shared across app."""
import os
from motor.motor_asyncio import AsyncIOMotorClient

_client: AsyncIOMotorClient | None = None
_db = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return _client


def get_db():
    global _db
    if _db is None:
        _db = get_client()[os.environ["DB_NAME"]]
    return _db


async def create_indexes():
    db = get_db()
    await db.users.create_index("mobile", unique=True)
    await db.users.create_index("role")
    await db.categories.create_index("name")
    await db.products.create_index("seller_id")
    await db.products.create_index("category_id")
    await db.orders.create_index("customer_id")
    await db.orders.create_index("status")
    await db.orders.create_index("created_at")
    await db.deliveries.create_index("order_id", unique=True)
    await db.deliveries.create_index("rider_id")
    await db.audit_logs.create_index("created_at")
    await db.delivery_verifications.create_index("order_id", unique=True)
    # Payment (Point 2 + 24)
    await db.payment_accounts.create_index([("type", 1), ("is_primary", 1)])
    await db.payment_transactions.create_index("merchant_order_id", unique=True)
    await db.payment_transactions.create_index([("gateway", 1), ("idempotency_key", 1)])
    await db.payment_transactions.create_index("linked_order_id")


def close_client():
    global _client
    if _client is not None:
        _client.close()
        _client = None
