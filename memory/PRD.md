# NEDS STORE — Product Requirements Document (Phase 1 delivered)

## Brand
- Name: **NEDS STORE** (Next Era Digital Solutions)
- Tagline: **Learn • Grow • Succeed**
- Colors: Enterprise Green (#059669) primary, Black (#09090B) surfaces, White (#FFFFFF) background
- Currency / Locale: INR (₹) · en-IN · India
- Android package name: `com.nedsstore.app` (used in Phase 2)

## Vision
Enterprise-grade hyperlocal multi-vendor commerce platform with **1 Android app** (role-based: Customer / Seller / Rider / Staff), **1 Admin Web Portal**, **1 common FastAPI backend**, and **1 common MongoDB database**.

## Phase 1 — COMPLETED (this iteration)

### Backend (FastAPI + MongoDB, modular)
- Modular routers: `auth`, `users`, `catalog` (categories + products), `orders` (orders + deliveries + verification), `admin` (business rules + dashboard + audit + payments).
- JWT auth (HS256, 24h), bcrypt password hashing, RBAC dependency injection (`require_admin`, `require_roles`, Super Admin bypass).
- Idempotent seed on startup: Super Admin (9999999999 / Admin@123), 6 categories, default business rules.
- Delivery Verification Code flow implemented end-to-end (auto-generated when rider location enters `verification_radius_meters` around the customer; visible only to customer/admin; rider enters code to mark Delivered; verification event logged with GPS coordinates + distance + timestamp).
- Audit logs on every write (login, user/product/category/rules changes, delivery events).
- Order lifecycle engine (placed → accepted → packed → out_for_delivery → delivered / cancelled).
- Commission engine + delivery-charge engine driven by configurable Business Rules.
- All `_id` fields excluded from responses; all datetimes stored as `datetime.now(timezone.utc)`.

### Admin Web Portal (React Native Web via Expo Router)
Built as a web route inside the same Expo project (Option A). Renders as a professional desktop dashboard on browsers ≥ 900px. Modular so it can later be extracted into a standalone web app.
- Login screen (Mobile + Password, split-pane branding + form)
- Fixed 260px black sidebar with green active-state highlight + role-tagged user footer with logout
- Sticky white header with route title + role badge + admin mobile
- Screens: Dashboard, Orders, Deliveries, Users, Products, Categories, Payments, Business Rules, Delivery Logs, Audit Logs
- Dashboard: 5 KPI cards, 7-day revenue bar chart, Live Rider Monitoring map placeholder (Google Maps swap-in with real key later), active-rider table
- All tables: dense enterprise style with pagination-ready DataTable, badges, monospace figures
- Business Rules Engine: fully editable (commission %, delivery radius km, delivery charge, free-delivery threshold, min order, verification radius m, platform name, support mobile). Changes take effect immediately on new orders.
- Delivery Verification logs: rider GPS, customer GPS, distance (m), timestamp
- Non-desktop viewport (< 900px) shows a "Desktop recommended" notice — Phase 2 Android app is the customer-facing surface.

### Integrations (as approved)
- **Payment:** UPI Intent + COD flow modeled in backend (implementation for Phase 2 rider/customer app). Architecture future-ready.
- **Google Maps:** Full architecture with placeholder API key (`GOOGLE_MAPS_API_KEY=REPLACE_ME`). No code change needed to swap the real key.
- **Auth:** Mobile + Password only. `/api/auth/request-otp` and `/api/auth/verify-otp` stubs return 501 (architecture ready).

## Phase 2 — Android App (planned, not built in Phase 1)
- Single Android app (`com.nedsstore.app`) with 4 role panels (Customer / Seller / Rider / Staff)
- Google Maps navigation, live rider GPS, Delivery Verification code display (Customer) and entry (Rider)
- UPI Intent (GPay/PhonePe/Paytm) + COD

## Phase 3 — Integration, QA, Production
- E2E integration, regression, APK build, store publish

## Strict rules honored
- Enterprise SRS = single source of truth (no self-decisions on core logic).
- Module Lock: Phase 1 backend + admin UI kept modular; future edits should be file-scoped.
- Credit Optimization: Reused components (Button, Input, Select, ModalCard, DataTable, Badge, KpiCard, Toast) across every screen.
- Google Maps and UPI: not skipped — real values swap in later without code changes.
- Package name `com.nedsstore.app` reserved for the Phase 2 Android app.

## Environment
- Backend: `/api/*` → port 8001 (via ingress). Bind `0.0.0.0:8001`.
- Frontend: Expo Router at port 3000.
- Env vars: `MONGO_URL`, `DB_NAME=nedsstore`, `JWT_SECRET_KEY`, `ACCESS_TOKEN_MINUTES=1440`, `GOOGLE_MAPS_API_KEY=REPLACE_ME`, `EXPO_PUBLIC_BACKEND_URL`.
