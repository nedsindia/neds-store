from fastapi import APIRouter
from db import get_db

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health")
async def health():
    db = get_db()
    await db.command("ping")
    return {"status": "ok", "database": "ok", "service": "neds-super-store-api"}
