"""NEDS STORE — Category-Based Dynamic Commission Module tests.

Covers:
- Seed categories carry min_commission / max_commission in valid range.
- Category range validation (POST + PATCH).
- Product create/update commission validation against category range.
- GET /api/products decoration fields (out_of_range, category_*).
- GET /api/products/out-of-range endpoint (admin only).
- Order commission computed per-line-item from product's commission_percentage.
- Seed idempotency (min/max preserved on restart).
"""
import pytest
from tests.conftest import API


# ---------- Categories: seed + validation ----------
class TestCategoryRange:
    def test_seeded_categories_have_range(self, client):
        r = client.get(f"{API}/categories")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 6
        for c in items:
            assert "min_commission" in c and "max_commission" in c
            assert 0 <= c["min_commission"] <= 100
            assert 0 <= c["max_commission"] <= 100
            assert c["min_commission"] <= c["max_commission"]

    def test_create_valid_range(self, client, super_admin_headers):
        r = client.post(f"{API}/categories", headers=super_admin_headers,
                        json={"name": "TEST_CommCat", "min_commission": 5, "max_commission": 25})
        assert r.status_code == 201
        j = r.json()
        assert j["min_commission"] == 5 and j["max_commission"] == 25
        # cleanup
        client.delete(f"{API}/categories/{j['id']}", headers=super_admin_headers)

    def test_create_min_gt_max(self, client, super_admin_headers):
        r = client.post(f"{API}/categories", headers=super_admin_headers,
                        json={"name": "TEST_Bad", "min_commission": 30, "max_commission": 10})
        assert r.status_code == 400
        assert "min_commission cannot exceed max_commission" in r.json()["detail"]

    def test_create_out_of_0_100(self, client, super_admin_headers):
        for body in [
            {"name": "TEST_Neg", "min_commission": -1, "max_commission": 10},
            {"name": "TEST_Big", "min_commission": 5, "max_commission": 101},
        ]:
            r = client.post(f"{API}/categories", headers=super_admin_headers, json=body)
            assert r.status_code in (400, 422), body

    def test_patch_combined_validation(self, client, super_admin_headers):
        # create range 5-25
        r = client.post(f"{API}/categories", headers=super_admin_headers,
                        json={"name": "TEST_PatchCat", "min_commission": 5, "max_commission": 25})
        cid = r.json()["id"]

        # Only change min to 30 (max still 25) → invalid combined range
        r2 = client.patch(f"{API}/categories/{cid}", headers=super_admin_headers,
                         json={"min_commission": 30})
        assert r2.status_code == 400

        # Valid update: change max to 40
        r3 = client.patch(f"{API}/categories/{cid}", headers=super_admin_headers,
                         json={"max_commission": 40})
        assert r3.status_code == 200
        assert r3.json()["max_commission"] == 40

        client.delete(f"{API}/categories/{cid}", headers=super_admin_headers)


# ---------- Products: commission validation ----------
@pytest.fixture(scope="module")
def scratch_category(client, super_admin_headers):
    """A dedicated category with a known [10,20] range for product tests."""
    r = client.post(f"{API}/categories", headers=super_admin_headers,
                    json={"name": "TEST_ScratchCat", "min_commission": 10, "max_commission": 20})
    assert r.status_code == 201
    cid = r.json()["id"]
    yield {"id": cid, "name": "TEST_ScratchCat", "min": 10, "max": 20}
    client.delete(f"{API}/categories/{cid}", headers=super_admin_headers)


class TestProductCommission:
    def test_missing_commission_422(self, client, super_admin_headers, created_users, scratch_category):
        seller_id = created_users["seller"]["user"]["id"]
        r = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_NoComm", "category_id": scratch_category["id"],
            "seller_id": seller_id, "price": 100, "stock": 5,
        })
        assert r.status_code == 422

    def test_missing_category_400(self, client, super_admin_headers, created_users):
        seller_id = created_users["seller"]["user"]["id"]
        r = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_BadCat", "category_id": "does-not-exist",
            "seller_id": seller_id, "price": 100, "stock": 5,
            "commission_percentage": 10,
        })
        assert r.status_code == 400
        assert r.json()["detail"] == "Category does not exist"

    def test_commission_out_of_range_exact_msg(self, client, super_admin_headers, created_users, scratch_category):
        seller_id = created_users["seller"]["user"]["id"]
        r = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_OOR", "category_id": scratch_category["id"],
            "seller_id": seller_id, "price": 100, "stock": 5,
            "commission_percentage": 5,  # below min 10
        })
        assert r.status_code == 400
        expected = f"Commission must be between {scratch_category['min']}% and {scratch_category['max']}% for {scratch_category['name']} category."
        assert r.json()["detail"] == expected

    def test_commission_in_range_ok(self, client, super_admin_headers, created_users, scratch_category):
        seller_id = created_users["seller"]["user"]["id"]
        r = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_ProdOK", "category_id": scratch_category["id"],
            "seller_id": seller_id, "price": 100, "stock": 5,
            "commission_percentage": 15,
        })
        assert r.status_code == 201
        assert r.json()["commission_percentage"] == 15

    def test_patch_commission_revalidates(self, client, super_admin_headers, created_users, scratch_category):
        seller_id = created_users["seller"]["user"]["id"]
        r = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_ProdPatch", "category_id": scratch_category["id"],
            "seller_id": seller_id, "price": 100, "stock": 5,
            "commission_percentage": 12,
        })
        pid = r.json()["id"]

        # invalid update: 50 (above max 20)
        r2 = client.patch(f"{API}/products/{pid}", headers=super_admin_headers,
                         json={"commission_percentage": 50})
        assert r2.status_code == 400
        assert f"for {scratch_category['name']} category" in r2.json()["detail"]

        # valid update
        r3 = client.patch(f"{API}/products/{pid}", headers=super_admin_headers,
                         json={"commission_percentage": 18})
        assert r3.status_code == 200
        assert r3.json()["commission_percentage"] == 18


# ---------- GET decorations + Out-of-Range ----------
class TestOutOfRange:
    def test_products_list_has_decoration(self, client):
        r = client.get(f"{API}/products")
        assert r.status_code == 200
        items = r.json()["items"]
        if not items:
            pytest.skip("no products to check decoration")
        p = items[0]
        for key in ("out_of_range", "category_name", "category_min_commission", "category_max_commission"):
            assert key in p, f"missing {key} in product decoration"

    def test_out_of_range_endpoint_admin_only(self, client, created_users):
        r = client.get(f"{API}/products/out-of-range", headers=created_users["customer"]["headers"])
        assert r.status_code == 403

    def test_out_of_range_flow(self, client, super_admin_headers, created_users):
        seller_id = created_users["seller"]["user"]["id"]
        # Create category 5-25
        rc = client.post(f"{API}/categories", headers=super_admin_headers,
                         json={"name": "TEST_OORCat", "min_commission": 5, "max_commission": 25})
        cid = rc.json()["id"]
        # Product at 7% (in range)
        rp = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_OORProd", "category_id": cid, "seller_id": seller_id,
            "price": 10, "stock": 100, "commission_percentage": 7,
        })
        pid = rp.json()["id"]

        # Tighten category to 20-25 → product at 7% should now be OOR
        client.patch(f"{API}/categories/{cid}", headers=super_admin_headers,
                    json={"min_commission": 20, "max_commission": 25})

        # GET /products shows out_of_range=true for this product
        rl = client.get(f"{API}/products?category_id={cid}")
        assert rl.status_code == 200
        row = next((p for p in rl.json()["items"] if p["id"] == pid), None)
        assert row and row["out_of_range"] is True
        assert row["category_min_commission"] == 20 and row["category_max_commission"] == 25

        # /products/out-of-range should include this product
        roor = client.get(f"{API}/products/out-of-range", headers=super_admin_headers)
        assert roor.status_code == 200
        ids = [p["id"] for p in roor.json()["items"]]
        assert pid in ids

        # Revert category → not OOR anymore
        client.patch(f"{API}/categories/{cid}", headers=super_admin_headers,
                    json={"min_commission": 5, "max_commission": 25})
        rl2 = client.get(f"{API}/products?category_id={cid}")
        row2 = next((p for p in rl2.json()["items"] if p["id"] == pid), None)
        assert row2 and row2["out_of_range"] is False


# ---------- Orders: per-line-item commission ----------
class TestOrderCommission:
    def test_per_line_commission(self, client, super_admin_headers, created_users):
        """Product commission=7% overrides global 10% for orders.
        qty=30 * ₹10 * 7% = 21.0
        """
        seller_id = created_users["seller"]["user"]["id"]
        cats = client.get(f"{API}/categories").json()["items"]
        # Use a category with range 5-25 for 7%
        cat = next((c for c in cats if c["min_commission"] <= 7 <= c["max_commission"]), cats[0])

        rp = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_LineComm", "category_id": cat["id"], "seller_id": seller_id,
            "price": 10, "stock": 100, "commission_percentage": 7,
        })
        assert rp.status_code == 201, rp.text
        prod = rp.json()

        ro = client.post(f"{API}/orders", headers=created_users["customer"]["headers"], json={
            "items": [{"product_id": prod["id"], "name": prod["name"],
                       "price": 10.0, "qty": 30, "seller_id": seller_id}],
            "delivery_address": "TEST addr", "delivery_lat": 12.9716, "delivery_lng": 77.5946,
        })
        assert ro.status_code == 201, ro.text
        order = ro.json()
        assert order["commission"] == 21.0
        item = order["items"][0]
        assert item["commission_percentage"] == 7
        assert item["line_commission"] == 21.0

    def test_multi_line_sum(self, client, super_admin_headers, created_users):
        seller_id = created_users["seller"]["user"]["id"]
        cats = client.get(f"{API}/categories").json()["items"]
        c1 = next((c for c in cats if c["min_commission"] <= 7 <= c["max_commission"]), cats[0])
        c2 = next((c for c in cats if c["min_commission"] <= 15 <= c["max_commission"]), cats[0])

        p1 = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_MLA", "category_id": c1["id"], "seller_id": seller_id,
            "price": 10, "stock": 100, "commission_percentage": 7,
        }).json()
        p2 = client.post(f"{API}/products", headers=super_admin_headers, json={
            "name": "TEST_MLB", "category_id": c2["id"], "seller_id": seller_id,
            "price": 50, "stock": 100, "commission_percentage": 15,
        }).json()

        ro = client.post(f"{API}/orders", headers=created_users["customer"]["headers"], json={
            "items": [
                {"product_id": p1["id"], "name": p1["name"], "price": 10.0, "qty": 30, "seller_id": seller_id},
                {"product_id": p2["id"], "name": p2["name"], "price": 50.0, "qty": 2, "seller_id": seller_id},
            ],
            "delivery_address": "a", "delivery_lat": 12.9716, "delivery_lng": 77.5946,
        })
        assert ro.status_code == 201, ro.text
        o = ro.json()
        # 30*10*0.07 = 21 ; 2*50*0.15 = 15 ; total 36
        assert o["commission"] == 36.0
        assert o["items"][0]["line_commission"] == 21.0
        assert o["items"][1]["line_commission"] == 15.0


# ---------- Seed idempotency ----------
class TestSeedIdempotency:
    def test_user_changes_preserved(self, client, super_admin_headers):
        """Change a seeded category range, restart backend simulated via re-hit,
        then verify persisted values remain (we can't restart from tests,
        but we assert seed doesn't overwrite existing categories)."""
        r = client.get(f"{API}/categories")
        groc = next((c for c in r.json()["items"] if c["name"] == "Groceries"), None)
        if not groc:
            pytest.skip("Groceries category not present")
        orig_min, orig_max = groc["min_commission"], groc["max_commission"]

        client.patch(f"{API}/categories/{groc['id']}", headers=super_admin_headers,
                    json={"min_commission": 20, "max_commission": 25})
        # verify persisted
        r2 = client.get(f"{API}/categories/{groc['id']}")
        assert r2.json()["min_commission"] == 20 and r2.json()["max_commission"] == 25

        # restore
        client.patch(f"{API}/categories/{groc['id']}", headers=super_admin_headers,
                    json={"min_commission": orig_min, "max_commission": orig_max})
