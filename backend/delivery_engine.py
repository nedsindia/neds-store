"""Enterprise Delivery Charge Engine.

Implements the exact 7-step formula from the NEDS STORE Phase 1 Improvement Doc
(Point 1). Pure function — no I/O — so it is trivially unit-testable and can be
reused by both `POST /api/orders` and `POST /api/checkout/preview`.

    Step 1  Calculate distance between seller & customer (haversine here; real
            Google Maps road distance will slot in when the real key ships).
    Step 2  If distance > maximum_delivery_radius_km → reject.
    Step 3  Apply minimum_delivery_charge.
    Step 4  Additional distance charge = max(0, distance - min_distance) * per_km.
    Step 5  Weight slab charge from configured weight_charge_rules.
    Step 6  Bulky product charge (per-item, multiplied by qty).
    Step 7  Free delivery: if enabled AND order_subtotal >= threshold, final = 0.
"""
import math
from typing import Any


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _pick_weight_slab(weight_kg: float, slabs: list[dict]) -> tuple[float, dict | None]:
    """Given total_weight and a list of slabs [{min_kg, max_kg|null, charge}], return (charge, slab)."""
    for s in slabs:
        lo = float(s.get("min_kg", 0) or 0)
        hi = s.get("max_kg")
        hi_val = float(hi) if hi is not None else None
        if weight_kg >= lo and (hi_val is None or weight_kg < hi_val):
            return float(s.get("charge", 0) or 0), s
    return 0.0, None


def calculate_delivery_charge(
    *,
    rules: dict,
    items: list[dict],
    products_by_id: dict[str, dict],
    customer_lat: float,
    customer_lng: float,
    seller_lat: float | None,
    seller_lng: float | None,
    order_subtotal: float,
) -> dict:
    """Return the full delivery-charge breakdown, per PRD step 8 & step 10."""
    # Backward-compatibility fallbacks: legacy fields → new fields.
    max_radius_km = float(rules.get("maximum_delivery_radius_km") or rules.get("delivery_radius_km") or 15)
    min_distance_km = float(rules.get("minimum_delivery_distance_km") or 2)
    min_charge = float(rules.get("minimum_delivery_charge") or rules.get("delivery_charge") or 20)
    per_km = float(rules.get("per_km_charge") or 7)
    free_threshold = float(rules.get("free_delivery_threshold") or rules.get("free_delivery_above") or 0)
    is_free_enabled = bool(rules.get("is_free_delivery_enabled", True))
    weight_slabs = list(rules.get("weight_charge_rules") or [])

    if seller_lat is None or seller_lng is None:
        seller_lat = float(rules.get("default_seller_lat") or 12.9716)
        seller_lng = float(rules.get("default_seller_lng") or 77.5946)

    distance_km = haversine_km(seller_lat, seller_lng, customer_lat, customer_lng)

    # Step 2: outside service area → reject
    if distance_km > max_radius_km:
        return {
            "distance_km": round(distance_km, 2),
            "within_service_area": False,
            "message": "Sorry, delivery service is currently unavailable in your area.",
            "final_delivery_charge": 0.0,
            "reject": True,
            "max_radius_km": max_radius_km,
            "seller_lat": seller_lat,
            "seller_lng": seller_lng,
        }

    # Weight & bulky calcs
    total_weight_kg = 0.0
    bulky_total = 0.0
    bulky_lines: list[dict] = []
    for it in items:
        p = products_by_id.get(it.get("product_id"))
        qty = int(it.get("qty", 1) or 1)
        if p:
            w = float(p.get("weight_kg") or 0)
            total_weight_kg += w * qty
            if p.get("is_bulky"):
                bc = float(p.get("bulky_charge") or 0) * qty
                bulky_total += bc
                bulky_lines.append({
                    "product_id": p.get("id"),
                    "name": p.get("name"),
                    "qty": qty,
                    "unit_charge": float(p.get("bulky_charge") or 0),
                    "line_charge": round(bc, 2),
                })

    # Steps 3-6
    extra_km = max(0.0, distance_km - min_distance_km)
    additional_distance_charge = round(extra_km * per_km, 2)
    weight_charge, weight_slab = _pick_weight_slab(total_weight_kg, weight_slabs)
    bulky_charge = round(bulky_total, 2)

    base_total = round(min_charge + additional_distance_charge + weight_charge + bulky_charge, 2)

    # Step 7 — free delivery
    free_applied = bool(is_free_enabled and free_threshold > 0 and order_subtotal >= free_threshold)
    final_delivery_charge = 0.0 if free_applied else base_total

    return {
        "distance_km": round(distance_km, 2),
        "within_service_area": True,
        "seller_lat": seller_lat,
        "seller_lng": seller_lng,
        "max_radius_km": max_radius_km,

        "minimum_delivery_distance_km": min_distance_km,
        "minimum_delivery_charge": round(min_charge, 2),

        "extra_km_over_minimum": round(extra_km, 2),
        "per_km_charge": per_km,
        "additional_distance_charge": additional_distance_charge,

        "total_weight_kg": round(total_weight_kg, 2),
        "weight_slab": weight_slab,
        "weight_charge": round(weight_charge, 2),

        "bulky_charge": bulky_charge,
        "bulky_items": bulky_lines,

        "base_total": base_total,

        "is_free_delivery_enabled": is_free_enabled,
        "free_delivery_threshold": free_threshold,
        "free_delivery_applied": free_applied,

        "final_delivery_charge": round(final_delivery_charge, 2),
        "reject": False,
    }


# -------------------------------------------------------------------- validation
def validate_delivery_rules(rules: dict) -> None:
    """Raise ValueError on any invalid input for the delivery engine.
    Called by admin PATCH /business-rules and by admin UI client-side."""
    def _neg(k):
        v = rules.get(k)
        if v is not None and float(v) < 0:
            raise ValueError(f"{k} cannot be negative")

    for k in ("minimum_delivery_distance_km", "minimum_delivery_charge", "per_km_charge",
              "maximum_delivery_radius_km", "free_delivery_threshold"):
        _neg(k)

    min_d = rules.get("minimum_delivery_distance_km")
    max_r = rules.get("maximum_delivery_radius_km")
    if min_d is not None and max_r is not None and float(max_r) <= float(min_d):
        raise ValueError("maximum_delivery_radius_km must be greater than minimum_delivery_distance_km")

    if bool(rules.get("is_free_delivery_enabled", True)):
        thr = rules.get("free_delivery_threshold")
        if thr is not None and float(thr) <= 0:
            raise ValueError("free_delivery_threshold must be greater than zero when free delivery is enabled")

    slabs = rules.get("weight_charge_rules")
    if slabs is not None:
        if not isinstance(slabs, list):
            raise ValueError("weight_charge_rules must be a list of slabs")
        # non-overlapping + non-negative charges; slabs sorted by min_kg
        norm: list[tuple[float, float | None]] = []
        for s in slabs:
            if not isinstance(s, dict):
                raise ValueError("Each weight slab must be an object")
            lo = float(s.get("min_kg", 0) or 0)
            hi = s.get("max_kg")
            hi_val = float(hi) if hi is not None else None
            ch = float(s.get("charge", 0) or 0)
            if lo < 0 or ch < 0:
                raise ValueError("Weight slab values cannot be negative")
            if hi_val is not None and hi_val <= lo:
                raise ValueError(f"Weight slab max_kg ({hi_val}) must be > min_kg ({lo})")
            norm.append((lo, hi_val))
        norm.sort(key=lambda t: t[0])
        for i in range(len(norm) - 1):
            lo_a, hi_a = norm[i]
            lo_b, _ = norm[i + 1]
            if hi_a is None:
                raise ValueError("Only the last weight slab may have an open-ended max_kg")
            if lo_b < hi_a:
                raise ValueError(f"Weight slabs overlap around {hi_a} kg")
