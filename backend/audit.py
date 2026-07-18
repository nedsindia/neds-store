"""Audit log helper — writes to audit_logs collection."""
from db import get_db
from models import new_id, utcnow


async def log_event(actor: dict | None, action: str, entity: str, entity_id: str | None = None, meta: dict | None = None):
    db = get_db()
    doc = {
        "id": new_id(),
        "actor_id": (actor or {}).get("id"),
        "actor_name": (actor or {}).get("name"),
        "actor_role": (actor or {}).get("role"),
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "meta": meta or {},
        "created_at": utcnow(),
    }
    await db.audit_logs.insert_one(doc)
