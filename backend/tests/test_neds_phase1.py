"""NEDS STORE Phase 1 — End-to-end backend tests."""
import time
import pytest
import requests
from tests.conftest import API, SUPER_ADMIN_MOBILE, SUPER_ADMIN_PASSWORD, _rand_mobile


# ---------------- Health / Root ----------------
class TestHealth:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        j = r.json()
        assert j["name"]
        assert j["version"]
        assert j["tagline"]
        assert j["status"] == "ok"

    def test_health(self, client):
        r = client.get(f"{API}/health")
        assert r.status_code == 200
        j = r.json()
        assert j.get("db") == "connected"


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self, client):
        r = client.post(f"{API}/auth/login", json={"mobile": SUPER_ADMIN_MOBILE, "password": SUPER_ADMIN_PASSWORD})
        assert r.status_code == 200
        j = r.json()
        assert "access_token" in j
        assert j["user"]["role"] == "super_admin"
        assert j["user"]["mobile"] == SUPER_ADMIN_MOBILE
        # Ensure Mongo _id and password hash not leaked
        assert "_id" not in j["user"]
        assert "password_hash" not in j["user"]

    def test_login_wrong_password(self, client):
        r = client.post(f"{API}/auth/login", json={"mobile": SUPER_ADMIN_MOBILE, "password": "WrongPass!"})
        assert r.status_code == 400
        assert "Invalid mobile number or password" in r.json()["detail"]

    def test_me_with_token(self, client, super_admin_headers):
        r = client.get(f"{API}/auth/me", headers=super_admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "super_admin"

    def test_me_without_token(self, client):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_request_otp_501(self, client):
        r = client.post(f"{API}/auth/request-otp", json={})
        assert r.status_code == 501


# ---------------- Users / RBAC ----------------
class TestUsers:
    def test_create_all_roles_and_duplicate(self, client, super_admin_headers, created_users):
        # All 6 roles created in fixture
        assert set(created_users.keys()) == {"manager", "staff_admin", "customer", "seller", "rider", "staff"}
        # Duplicate mobile → 409
        dup_mobile = created_users["customer"]["mobile"]
        r = client.post(
            f"{API}/users", headers=super_admin_headers,
            json={"name": "Dup", "mobile": dup_mobile, "password": "x1", "role": "customer"},
        )
        assert r.status_code == 409

    def test_list_users_filters_and_pagination(self, client, super_admin_headers, created_users):
        r = client.get(f"{API}/users?role=rider&limit=100", headers=super_admin_headers)
        assert r.status_code == 200
        j = r.json()
        assert "items" in j and "total" in j
        assert all(u["role"] == "rider" for u in j["items"])

        # q filter (search by name)
        r2 = client.get(f"{API}/users?q=TEST_seller", headers=super_admin_headers)
        assert r2.status_code == 200
        assert any("TEST_seller" in u["name"] for u in r2.json()["items"])

        # pagination
        r3 = client.get(f"{API}/users?limit=1&skip=0", headers=super_admin_headers)
        assert r3.status_code == 200
        assert len(r3.json()["items"]) <= 1

    def test_patch_and_delete_user(self, client, super_admin_headers, created_users):
        uid = created_users["staff"]["user"]["id"]
        r = client.patch(f"{API}/users/{uid}", headers=super_admin_headers, json={"name": "TEST_staff_renamed"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_staff_renamed"

        r2 = client.delete(f"{API}/users/{uid}", headers=super_admin_headers)
        assert r2.status_code == 200

        r3 = client.get(f"{API}/users/{uid}", headers=super_admin_headers)
        assert r3.status_code == 200
        assert r3.json()["active"] is False

    def test_customer_cannot_list_users(self, client, created_users):
        r = client.get(f"{API}/users", headers=created_users["customer"]["headers"])
        assert r.status_code == 403

    def test_manager_can_list_but_not_create_admin(self, client, created_users):
        mgr_headers = created_users["manager"]["headers"]
        r = client.get(f"{API}/users", headers=mgr_headers)
        assert r.status_code == 200

        # Manager tries to create a manager → 403
        r2 = client.post(f"{API}/users", headers=mgr_headers, json={
            "name": "TEST_bad_admin", "mobile": _rand_mobile(), "password": "x1", "role": "manager",
        })
        assert r2.status_code == 403

        r3 = client.post(f"{API}/users", headers=mgr_headers, json={
            "name": "TEST_bad_super", "mobile": _rand_mobile(), "password": "x1", "role": "super_admin",
        })
        assert r3.status_code == 403


# ---------------- Catalog ----------------
class TestCatalog:
    def test_categories_seeded(self, client):
        r = client.get(f"{API}/categories")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 6

    def test_category_crud(self, client, super_admin_headers):
        r = client.post(f"{API}/categories", headers=super_admin_headers, json={"name": "TEST_Cat"})
        assert r.status_code == 201
        cid = r.json()["id"]
        r2 = client.patch(f"{API}/categories/{cid}", headers=super_admin_headers, json={"description": "d"})
        assert r2.status_code == 200
        assert r2.json()["description"] == "d"
        r3 = client.delete(f"{API}/categories/{cid}", headers=super_admin_headers)
        assert r3.status_code == 200

    def test_product_create_and_filters(self, client, super_admin_headers, created_users):
        cats = client.get(f"{API}/categories").json()["items"]
        cid = cats[0]["id"]
        seller_id = created_users["seller"]["user"]["id"]

        # admin creates for seller
        r = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_Product_A", "category_id": cid, "seller_id": seller_id,
            "price": 100.0, "stock": 5, "unit": "pc", "commission_percentage": 10,
        })
        assert r.status_code == 201
        assert r.json()["seller_id"] == seller_id

        # invalid category
        rbad = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_bad", "category_id": "nope", "seller_id": seller_id, "price": 10,
            "commission_percentage": 10,
        })
        assert rbad.status_code == 400

        # seller creates only their own
        r2 = client.post(f"{API}/products", headers=created_users["seller"]["headers"], json={
            "name": "TEST_Product_Sel", "category_id": cid, "seller_id": "someone-else",
            "price": 50.0, "stock": 3, "commission_percentage": 10,
        })
        assert r2.status_code == 201
        # seller_id must be overridden to seller's own id
        assert r2.json()["seller_id"] == seller_id

        # filters
        r3 = client.get(f"{API}/products?q=TEST_Product&seller_id={seller_id}")
        assert r3.status_code == 200
        assert all(p["seller_id"] == seller_id for p in r3.json()["items"])
        r4 = client.get(f"{API}/products?category_id={cid}")
        assert r4.status_code == 200
        assert all(p["category_id"] == cid for p in r4.json()["items"])


# ---------------- Orders + Deliveries ----------------
@pytest.fixture(scope="session")
def order_context(client, super_admin_headers, created_users):
    """Create a product and an order for further delivery tests."""
    cats = client.get(f"{API}/categories").json()["items"]
    cid = cats[0]["id"]
    seller_id = created_users["seller"]["user"]["id"]
    rp = client.post(f"{API}/products", headers=super_admin_headers, json={
        "name": "TEST_OrderProduct", "category_id": cid, "seller_id": seller_id,
        "price": 200.0, "stock": 10, "commission_percentage": 10,
    })
    assert rp.status_code == 201
    prod = rp.json()

    # Create an order as customer (subtotal 400, below free-delivery threshold → charge 30)
    customer_headers = created_users["customer"]["headers"]
    order_payload = {
        "items": [{"product_id": prod["id"], "name": prod["name"], "price": 200.0, "qty": 2, "seller_id": seller_id}],
        "delivery_address": "TEST addr",
        "delivery_lat": 12.9716,
        "delivery_lng": 77.5946,
        "payment_method": "cod",
    }
    ro = client.post(f"{API}/orders", headers=customer_headers, json=order_payload)
    assert ro.status_code == 201, ro.text
    return {"product": prod, "order": ro.json(), "customer_id": created_users["customer"]["user"]["id"]}


class TestOrders:
    def test_min_order_enforced(self, client, created_users):
        headers = created_users["customer"]["headers"]
        r = client.post(f"{API}/orders", headers=headers, json={
            "items": [{"product_id": "x", "name": "cheap", "price": 10, "qty": 1}],
            "delivery_address": "a", "delivery_lat": 0, "delivery_lng": 0,
        })
        assert r.status_code == 400
        assert "Minimum" in r.json()["detail"]

    def test_order_pricing(self, order_context):
        o = order_context["order"]
        assert o["subtotal"] == 400.0
        assert o["delivery_charge"] == 30.0  # under free threshold 499
        assert o["commission"] == 40.0       # 10% of 400
        assert o["total"] == 430.0
        assert o["status"] == "placed"
        assert o["payment_status"] == "pending"

    def test_free_delivery_threshold(self, client, created_users, super_admin_headers):
        # Create an order with subtotal >= 499 → delivery_charge should be 0
        cats = client.get(f"{API}/categories").json()["items"]
        cid = cats[0]["id"]
        seller_id = created_users["seller"]["user"]["id"]
        rp = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_BigProduct", "category_id": cid, "seller_id": seller_id,
            "price": 500.0, "stock": 10, "commission_percentage": 10,
        })
        prod = rp.json()
        ro = client.post(f"{API}/orders", headers=created_users["customer"]["headers"], json={
            "items": [{"product_id": prod["id"], "name": prod["name"], "price": 500.0, "qty": 1, "seller_id": seller_id}],
            "delivery_address": "TEST addr big",
            "delivery_lat": 12.9716, "delivery_lng": 77.5946,
        })
        assert ro.status_code == 201
        assert ro.json()["delivery_charge"] == 0.0

    def test_orders_scoping(self, client, super_admin_headers, created_users, order_context):
        # admin sees all
        r_admin = client.get(f"{API}/orders", headers=super_admin_headers)
        assert r_admin.status_code == 200
        assert r_admin.json()["total"] >= 1

        # customer sees only own
        r_cust = client.get(f"{API}/orders", headers=created_users["customer"]["headers"])
        assert r_cust.status_code == 200
        assert all(o["customer_id"] == order_context["customer_id"] for o in r_cust.json()["items"])

        # rider sees only assigned (initially 0)
        r_rider = client.get(f"{API}/orders", headers=created_users["rider"]["headers"])
        assert r_rider.status_code == 200

    def test_status_update_reject_delivered(self, client, super_admin_headers, order_context):
        oid = order_context["order"]["id"]
        r = client.patch(f"{API}/orders/{oid}/status", headers=super_admin_headers, json={"status": "delivered"})
        assert r.status_code == 400


class TestDeliveries:
    def test_auto_delivery_created(self, client, super_admin_headers, order_context):
        oid = order_context["order"]["id"]
        # list deliveries and find the one for this order
        r = client.get(f"{API}/deliveries", headers=super_admin_headers)
        assert r.status_code == 200
        found = [d for d in r.json()["items"] if d["order_id"] == oid]
        assert found, "auto delivery not created"
        assert found[0]["status"] == "pending_assignment"

    def test_assign_and_location_and_verify(self, client, super_admin_headers, created_users, order_context):
        oid = order_context["order"]["id"]
        rider_id = created_users["rider"]["user"]["id"]
        rider_headers = created_users["rider"]["headers"]

        # find delivery id
        r = client.get(f"{API}/deliveries", headers=super_admin_headers)
        delivery = next(d for d in r.json()["items"] if d["order_id"] == oid)
        did = delivery["id"]

        # assign rider
        r_assign = client.post(f"{API}/deliveries/{did}/assign", headers=super_admin_headers, json={"rider_id": rider_id})
        assert r_assign.status_code == 200

        # order should be accepted now
        r_ord = client.get(f"{API}/orders/{oid}", headers=super_admin_headers)
        assert r_ord.status_code == 200
        assert r_ord.json()["status"] == "accepted"

        # send rider location FAR AWAY — no code
        r_loc_far = client.post(f"{API}/deliveries/{did}/location", headers=rider_headers,
                                json={"lat": 20.0, "lng": 80.0})
        assert r_loc_far.status_code == 200
        assert "verification_code" not in r_loc_far.json()

        # send rider location within 200m of delivery point (very close)
        r_loc_near = client.post(f"{API}/deliveries/{did}/location", headers=rider_headers,
                                 json={"lat": 12.9716, "lng": 77.5946})
        assert r_loc_near.status_code == 200
        body = r_loc_near.json()
        assert "verification_code" not in body, "Rider must NOT see verification code"
        assert body["status"] == "at_customer"

        # Admin should be able to see the code (via order GET → delivery)
        r_ord2 = client.get(f"{API}/orders/{oid}", headers=super_admin_headers)
        code = r_ord2.json()["delivery"]["verification_code"]
        assert code and len(code) == 4 and code.isdigit()

        # Wrong code → 400, order must not flip
        r_wrong = client.post(f"{API}/deliveries/{did}/verify", headers=rider_headers,
                              json={"code": "0000" if code != "0000" else "1111",
                                    "rider_lat": 12.9716, "rider_lng": 77.5946})
        assert r_wrong.status_code == 400
        r_check = client.get(f"{API}/orders/{oid}", headers=super_admin_headers)
        assert r_check.json()["status"] != "delivered"

        # Correct code → delivered, payment paid (COD)
        r_ok = client.post(f"{API}/deliveries/{did}/verify", headers=rider_headers,
                           json={"code": code, "rider_lat": 12.9716, "rider_lng": 77.5946})
        assert r_ok.status_code == 200, r_ok.text
        v = r_ok.json()["verification"]
        assert v["rider_id"] == rider_id
        assert v["order_id"] == oid
        assert "distance_m" in v

        r_final = client.get(f"{API}/orders/{oid}", headers=super_admin_headers)
        j = r_final.json()
        assert j["status"] == "delivered"
        assert j["payment_status"] == "paid"


# ---------------- Business rules + Admin ----------------
class TestBusinessRules:
    def test_get_and_patch_and_effect(self, client, super_admin_headers, created_users):
        r = client.get(f"{API}/business-rules", headers=super_admin_headers)
        assert r.status_code == 200
        orig = r.json()
        assert orig["commission_percent"] == 10.0 or "commission_percent" in orig

        # PATCH commission to 15%
        r2 = client.patch(f"{API}/business-rules", headers=super_admin_headers, json={"commission_percent": 15.0})
        assert r2.status_code == 200
        assert r2.json()["commission_percent"] == 15.0

        # Create a new order; commission should reflect 15%
        cats = client.get(f"{API}/categories").json()["items"]
        cid = cats[0]["id"]
        seller_id = created_users["seller"]["user"]["id"]
        # Note: Order commission now derives from PRODUCT commission_percentage, not from rules.
        # Use product with 15% commission to confirm 30.0 total.
        rp = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_RuleProduct", "category_id": cid, "seller_id": seller_id,
            "price": 100, "stock": 5, "commission_percentage": 15,
        })
        prod = rp.json()
        ro = client.post(f"{API}/orders", headers=created_users["customer"]["headers"], json={
            "items": [{"product_id": prod["id"], "name": prod["name"], "price": 100.0, "qty": 2, "seller_id": seller_id}],
            "delivery_address": "a", "delivery_lat": 0, "delivery_lng": 0,
        })
        assert ro.status_code == 201
        assert ro.json()["commission"] == 30.0  # 15% of 200

        # Restore
        client.patch(f"{API}/business-rules", headers=super_admin_headers, json={"commission_percent": 10.0})


class TestDashboard:
    def test_summary(self, client, super_admin_headers):
        r = client.get(f"{API}/dashboard/summary", headers=super_admin_headers)
        assert r.status_code == 200
        j = r.json()
        assert "kpis" in j and "trend" in j
        for k in ["total_orders", "todays_orders", "total_revenue", "active_riders"]:
            assert k in j["kpis"]

    def test_live_riders(self, client, super_admin_headers):
        r = client.get(f"{API}/dashboard/live-riders", headers=super_admin_headers)
        assert r.status_code == 200
        assert "items" in r.json()


class TestAudit:
    def test_audit_entries_present(self, client, super_admin_headers):
        r = client.get(f"{API}/audit-logs", headers=super_admin_headers)
        assert r.status_code == 200
        actions = {log["action"] for log in r.json()["items"]}
        # Various flows should have written audits
        expected_any = {"login", "user.create", "order.create", "delivery.verified", "rules.update"}
        assert expected_any & actions, f"Expected some of {expected_any} in {actions}"
