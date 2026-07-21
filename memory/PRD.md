# NEDS STORE — Product Requirements Document

## Brand
- Name: **NEDS STORE** (Next Era Digital Solutions)
- Tagline: **Learn • Grow • Succeed**
- Colors: Enterprise Green (#059669) primary, Black (#09090B) surfaces, White (#FFFFFF) background
- Currency / Locale: INR (₹) · en-IN · India
- Android package name: `com.nedsstore.app` (used in Phase 2)

## Vision
Enterprise-grade hyperlocal multi-vendor commerce platform with **1 Android app** (role-based: Customer / Seller / Rider / Staff), **1 Admin Web Portal**, **1 common FastAPI backend**, and **1 common MongoDB database**.

## Phase 1 — COMPLETED

### Backend (FastAPI + MongoDB, modular)
- Modular routers: `auth`, `users`, `catalog` (categories + products), `orders` (orders + deliveries + verification), `admin` (business rules + dashboard + audit + payments).
- JWT auth (HS256, 24h), bcrypt password hashing, RBAC dependency injection (`require_admin`, `require_roles`, Super Admin bypass).
- Idempotent seed on startup: Super Admin (9999999999 / Admin@123), 6 categories, default business rules.
- Delivery Verification Code flow end-to-end (auto-generated within `verification_radius_meters`, visible only to customer/admin, rider enters to mark Delivered, full GPS + distance audit).
- Audit logs on every write; Order lifecycle engine; Delivery-charge engine.
- All `_id` fields excluded from responses; all datetimes UTC.

### Admin Web Portal (React Native Web via Expo Router, Option A)
- Login → 10 admin screens (Dashboard, Orders, Deliveries, Users, Products, Categories, Payments, Business Rules, Delivery Logs, Audit Logs)
- Fixed 260px black sidebar with green accent, sticky header, DataTable/KpiCard/Badge/Modal/Toast component system
- Google Maps placeholder for live-rider view (real key swaps in with zero code changes)

## Enterprise Delivery Charge Engine (Point 1 of 24) — COMPLETED (this iteration)

### Backend
- New pure-function engine at `/app/backend/delivery_engine.py` implementing the exact PRD 7-step formula: distance (haversine — road-distance via Google Maps swaps in later with the real key) → service-area check → minimum charge → per-km extra → weight slab → bulky items → free-delivery override.
- Business Rules extended with: `minimum_delivery_distance_km`, `minimum_delivery_charge`, `per_km_charge`, `maximum_delivery_radius_km`, `free_delivery_threshold`, `is_free_delivery_enabled`, `weight_charge_rules` (list of slabs), `default_seller_lat/lng`. Idempotent backfill on startup.
- Products carry `weight_kg`, `is_bulky`, `bulky_charge`. Sellers carry `address_lat/address_lng`.
- New endpoint `POST /api/checkout/preview` returns full breakdown for the customer-app checkout screen (per PRD Feature 10).
- New endpoint `GET /api/delivery-charge-rules` — curated slice for mobile clients.
- `POST /api/orders` uses the engine, rejects with 400 + exact PRD message when the customer is outside the max radius, and stores full `delivery_breakdown` on the order document.
- Validation: negatives rejected; `maximum_delivery_radius_km` must exceed `minimum_delivery_distance_km`; overlapping weight slabs rejected with the exact "Weight slabs overlap around X kg" message; `is_free_delivery_enabled=true` requires threshold > 0.

### Admin UI (`/admin/rules`)
- Restructured into 3 sections:
  1. **Enterprise Delivery Charge Engine** — 8 numeric fields + "Enable Free Delivery" switch
  2. **Weight-Based Delivery Charges** — dynamic slab editor (add/remove rows with trash icon; last slab may leave Max blank for open-ended)
  3. **General & Verification** — legacy fallback settings
- Client-side cross-checks (max > min, threshold > 0 when free enabled, no overlapping slabs) fire before hitting the server.

### Admin UI (`/admin/products`)
- Product Add/Edit modal gets a new "Delivery Engine" section with Weight (kg) input, Bulky Item switch, and Bulky Charge (₹) input (disabled/greyed until Bulky is on).

### Verification (this turn)
Backend smoke-tested via 5 curl scenarios per the PRD examples — all pass:
- 0.8 km × 2 kg → ₹20 (min charge only)
- 5 km × 2 kg → ₹40.95 (min + per-km extra)
- 5 km × 12 kg bulky refrigerator → ₹240.95 (min + per-km + 10-20kg slab + bulky)
- 40+ km beyond max radius → rejected with the exact PRD message
- 5 km bulky at subtotal ≥ 1000 → free-delivery kicks in (final=0 while base_total shows the calculated fee)
Frontend Rules page renders all 3 sections correctly (screenshot verified).

## Category-Based Dynamic Commission Module — COMPLETED (prior iteration)

### Backend
- Category schema now carries `min_commission` and `max_commission` (0–100, min ≤ max). Validated on create + patch.
- Product schema now requires `commission_percentage` at create; validated to fall within the category's current range at both create and update. Error message: `Commission must be between X% and Y% for <CATEGORY> category.` (whole numbers rendered as integers per PRD).
- `GET /api/products` decorates each row with `out_of_range`, `category_name`, `category_min_commission`, `category_max_commission`.
- `GET /api/products/out-of-range` (admin) returns exactly the products whose stored commission now falls outside their category's current range.
- **Order commission is now computed PER LINE ITEM**: `commission = Σ (price × qty × product.commission_percentage / 100)`. Each order line stores `commission_percentage` and `line_commission`. Global `rules.commission_percent` is only a legacy fallback if a legacy product has no commission set.
- Category-range tightening does NOT auto-correct existing products — they surface as Out of Range for admin/seller review (business rule #5).
- Backfill migration on startup: any pre-existing category without min/max is set to 5%–20%; any product without `commission_percentage` is set to its category minimum.

### Admin UI
- **Categories page**: banner explaining the module; new "Commission Range" column with `X% – Y%` label and green range-bar; Edit + Disable per row; Add/Edit modal captures min/max with local min ≤ max validation.
- **Products page**: new "Commission" column showing product % with `range X–Y%` hint below; red danger badge "Out of Range" on offending rows; toolbar counter/toggle "Out of Range: N" filters to only OOR rows; warning banner when N > 0; Add/Edit modal shows dynamic "Allowed range for <Category>: X% – Y%" hint, quick-pick chips (up to 6 within the range), client-side validation with the exact PRD error message.

### Integrations (as approved)
- **Payment:** UPI Intent + COD flow modeled backend-side (mobile UIs in Phase 2).
- **Google Maps:** Full architecture with placeholder key.
- **Auth:** Mobile + Password only; OTP endpoints return 501 (architecture ready).

## Phase 1 Improvement Points (from user's 24-point doc)
- **Point 1 — Enterprise Delivery Charge Engine** ✅
- **Point 2 — Enterprise Payment Configuration Module** ✅ (with 6 admin refinements: strict UPI validation, single-primary-across-all, masked account-numbers in list & full via audit-logged detail endpoint, granular audit events for create/edit/enable/disable/set-primary/delete/view_full, canonical txn field names, prominent placeholder banner)
- **Point 24 — PhonePe Payment Gateway Integration** ✅ (this turn, placeholder mode)
- Points 3–23 pending, will be added one by one in subsequent turns.
- **Full testing_agent regression will run after all 24 modules are complete, per user directive.**

## Phase 2 — Android App (planned)
- Single Android app (`com.nedsstore.app`) with 4 role panels; UPI Intent + COD; Google Maps navigation; Delivery Verification Code UI (customer sees, rider enters); Seller product screen will reuse the same commission-range picker pattern.

## Strict rules honored
- Enterprise Docs = source of truth.
- Module Lock respected: this iteration only touched `models.py`, `catalog_routes.py`, `order_routes.py`, `seed.py`, `admin/categories.tsx`, `admin/products.tsx`.
- Credit Optimization: reused all existing components (DataTable, ModalCard, Input, Select, Button, Badge, Toast); no duplicate logic.
- Package name `com.nedsstore.app` reserved for Phase 2 build.

## Environment
- Backend: `/api/*` → port 8001. Bind `0.0.0.0:8001`.
- Frontend: Expo Router at port 3000.
- Env vars: `MONGO_URL`, `DB_NAME=nedsstore`, `JWT_SECRET_KEY`, `ACCESS_TOKEN_MINUTES=1440`, `GOOGLE_MAPS_API_KEY=REPLACE_ME`, `EXPO_PUBLIC_BACKEND_URL`.
