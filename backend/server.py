"""NEDS SUPER STORE — Backend Entry Point."""
import logging
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from starlette.middleware.cors import CORSMiddleware
ROOT_DIR=Path(__file__).parent
load_dotenv(ROOT_DIR/".env")
from db import close_client, create_indexes, get_db
from routes.admin_routes import router as admin_router
from routes.auth_routes import router as auth_router
from routes.catalog_routes import router as catalog_router
from routes.coupon_routes import router as coupon_router
from routes.customer_routes import router as customer_router
from routes.inventory_routes import router as inventory_router
from routes.invoice_routes import router as invoice_router
from routes.ops_routes import router as ops_router
from routes.order_routes import router as order_router
from routes.payment_routes import router as payment_router
from routes.public_routes import router as public_router
from routes.rbac_routes import router as rbac_router
from routes.refund_routes import router as refund_router
from routes.settlement_routes import router as settlement_router
from routes.staff_routes import router as staff_router
from routes.user_routes import router as user_router
from seed import seed_all
logging.basicConfig(level=logging.INFO,format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger=logging.getLogger("neds")
app=FastAPI(title="NEDS SUPER STORE API",version="1.0.0",description="Next Era Digital Solutions — Hyperlocal Commerce Platform")
api_router=APIRouter(prefix="/api")
@api_router.get("/")
async def root(): return {"name":"NEDS SUPER STORE API","version":"1.0.0","tagline":"Learn • Grow • Succeed","status":"ok"}
@api_router.get("/health")
async def health():
    try: await get_db().command("ping"); return {"status":"ok","db":"connected"}
    except Exception as e: raise HTTPException(status_code=503,detail="Database unavailable") from e
for r in (auth_router,user_router,catalog_router,order_router,inventory_router,invoice_router,payment_router,settlement_router,refund_router,coupon_router,customer_router,public_router,staff_router,ops_router,rbac_router,admin_router): api_router.include_router(r)
app.include_router(api_router)
raw_origins=os.getenv("CORS_ORIGINS","")
origins=[x.strip() for x in raw_origins.split(",") if x.strip()] or ["*"]
app.add_middleware(CORSMiddleware,allow_credentials=origins != ["*"],allow_origins=origins,allow_methods=["*"],allow_headers=["*"])
@app.on_event("startup")
async def startup():
    logger.info("NEDS SUPER STORE backend starting")
    await create_indexes()
    if os.getenv("NEDS_ENABLE_SEED","0")=="1": await seed_all()
    else: logger.info("Production seed disabled")
@app.on_event("shutdown")
async def shutdown(): close_client()
