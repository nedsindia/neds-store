"""Authentication: JWT + bcrypt + RBAC dependencies for FastAPI."""
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext

from db import get_db

# Roles (strings — kept simple, matches problem statement)
ROLE_SUPER_ADMIN = "super_admin"
ROLE_MANAGER = "manager"
ROLE_STAFF_ADMIN = "staff_admin"
ROLE_CUSTOMER = "customer"
ROLE_SELLER = "seller"
ROLE_RIDER = "rider"
ROLE_STAFF = "staff"

ADMIN_ROLES = {ROLE_SUPER_ADMIN, ROLE_MANAGER, ROLE_STAFF_ADMIN}
ALL_ROLES = {ROLE_SUPER_ADMIN, ROLE_MANAGER, ROLE_STAFF_ADMIN, ROLE_CUSTOMER, ROLE_SELLER, ROLE_RIDER, ROLE_STAFF}

JWT_SECRET = os.environ.get("JWT_SECRET_KEY", "neds-dev-secret-change-me")
JWT_ALGO = "HS256"
ACCESS_TOKEN_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "1440"))  # 24h for dev

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
_DUMMY_HASH = pwd_ctx.hash("dummy-password-for-timing")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=True)


def hash_password(pwd: str) -> str:
    return pwd_ctx.hash(pwd)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def create_access_token(user_id: str, mobile: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "mobile": mobile,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
        if not user_id:
            raise credentials_exc
    except InvalidTokenError:
        raise credentials_exc

    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise credentials_exc
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    return user


def require_roles(*allowed: str):
    """Dependency factory. Super Admin always allowed."""
    async def dep(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
        role = current_user.get("role")
        if role == ROLE_SUPER_ADMIN or role in allowed:
            return current_user
        raise HTTPException(status_code=403, detail="Forbidden — insufficient role")
    return dep


require_admin = require_roles(ROLE_MANAGER, ROLE_STAFF_ADMIN)
require_super_admin = require_roles()  # Super Admin only


async def authenticate(mobile: str, password: str) -> dict | None:
    db = get_db()
    user = await db.users.find_one({"mobile": mobile})
    if not user:
        pwd_ctx.verify(password, _DUMMY_HASH)  # timing attack mitigation
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    if not user.get("active", True):
        return None
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user
