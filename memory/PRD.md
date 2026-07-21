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

## Category-Based Dynamic Commission Module — COMPLETED (this iteration)

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
