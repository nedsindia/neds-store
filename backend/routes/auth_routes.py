"""Auth routes: login, me. Mobile + Password only (v1.0). OTP endpoints reserved."""
from fastapi import APIRouter, Depends, HTTPException

from audit import log_event
from auth import authenticate, create_access_token, get_current_user
from models import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await authenticate(body.mobile, body.password)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid mobile number or password")
    token = create_access_token(user["id"], user["mobile"], user["role"])
    await log_event(user, "login", "user", user["id"])
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


# --- OTP architecture reserved (not implemented in v1.0) ---
@router.post("/request-otp", status_code=501)
async def request_otp():
    raise HTTPException(status_code=501, detail="OTP flow reserved for future release")


@router.post("/verify-otp", status_code=501)
async def verify_otp():
    raise HTTPException(status_code=501, detail="OTP flow reserved for future release")
