"""Shared fixtures for NEDS STORE backend tests."""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL (public URL used by testing)
load_dotenv(Path("/app/frontend/.env"))

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_ADMIN_MOBILE = "9999999999"
SUPER_ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="session")
def api_base():
    return API


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def super_admin_token(client):
    r = client.post(f"{API}/auth/login", json={"mobile": SUPER_ADMIN_MOBILE, "password": SUPER_ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def super_admin_headers(super_admin_token):
    return {"Authorization": f"Bearer {super_admin_token}", "Content-Type": "application/json"}


def _rand_mobile():
    # Ensure 10-digit numeric mobile
    n = uuid.uuid4().int % 10_000_000_000
    s = f"{n:010d}"
    # Avoid super-admin
    if s == SUPER_ADMIN_MOBILE:
        s = "8" + s[1:]
    return s


@pytest.fixture(scope="session")
def created_users(client, super_admin_headers):
    """Create one user per role and return {role: {user, token, mobile, password}}."""
    users = {}
    roles = ["manager", "staff_admin", "customer", "seller", "rider", "staff"]
    for role in roles:
        mob = _rand_mobile()
        pwd = "Passw0rd!"
        body = {"name": f"TEST_{role}", "mobile": mob, "password": pwd, "role": role}
        r = client.post(f"{API}/users", headers=super_admin_headers, json=body)
        assert r.status_code == 201, f"create {role} failed: {r.status_code} {r.text}"
        u = r.json()
        # Login to get token
        rl = client.post(f"{API}/auth/login", json={"mobile": mob, "password": pwd})
        assert rl.status_code == 200, f"login {role} failed: {rl.text}"
        users[role] = {
            "user": u,
            "token": rl.json()["access_token"],
            "mobile": mob,
            "password": pwd,
            "headers": {"Authorization": f"Bearer {rl.json()['access_token']}", "Content-Type": "application/json"},
        }
    return users
