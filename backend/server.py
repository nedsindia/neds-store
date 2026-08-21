"""NEDS STORE — Backend Entry Point.
Enterprise-grade FastAPI backend with modular routers.

All routes are prefixed with `/api` per platform convention.
"""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Import after .env loaded
from db import close_client, create_indexes, get_db  # noqa: E402
from routes.admin_routes import router as admin_router  # noqa: E402
from routes.auth_routes import router as auth_router  # noqa: E402
from routes.catalog_routes import router as catalog_router  # noqa: E402
from routes.coupon_routes import router as coupon_router  # noqa: E402
from routes.inventory_routes import router as inventory_router  # noqa: E402
from routes.invoice_routes import router as invoice_router  # noqa: E402
from routes.ops_routes import router as ops_router  # noqa: E402
from routes.order_routes import router as order_router  # noqa: E402
from routes.payment_routes import router as payment_router  # noqa: E402
from routes.rbac_routes import router as rbac_router  # noqa: E402
from routes.refund_routes import router as refund_router  # noqa: E402
from routes.settlement_routes import router as settlement_router  # noqa: E402
from routes.staff_routes import router as staff_router  # noqa: E402
from routes.user_routes import router as user_router  # noqa: E402
from seed import seed_all  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("neds")

app = FastAPI(title="NEDS STORE API", version="1.0.0", description="Next Era Digital Solutions — Hyperlocal Commerce Platform")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {
        "name": "NEDS STORE API",
        "version": "1.0.0",
        "tagline": "Learn • Grow • Succeed",
        "status": "ok",
    }


@api_router.get("/health")
async def health():
    try:
        db = get_db()
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:  # pragma: no cover
        return {"status": "error", "db": str(e)}


# Mount routers under /api
api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(catalog_router)
api_router.include_router(order_router)
api_router.include_router(inventory_router)
api_router.include_router(invoice_router)
api_router.include_router(payment_router)
api_router.include_router(settlement_router)
api_router.include_router(refund_router)
api_router.include_router(coupon_router)
api_router.include_router(staff_router)
api_router.include_router(ops_router)
api_router.include_router(rbac_router)
api_router.include_router(admin_router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    logger.info("NEDS STORE backend starting up")
    await create_indexes()
    await seed_all()
    logger.info("NEDS STORE backend ready")


@app.on_event("shutdown")
async def shutdown():
    close_client()
    logger.info("NEDS STORE backend shut down")
