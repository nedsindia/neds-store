# NEDS STORE

**Next Era Digital Solutions** — Enterprise-grade hyperlocal multi-vendor commerce platform.

> **Tagline:** Learn • Grow • Succeed
> **Version:** 1.0 (Phase 1 Complete)
> **Locale:** INR (₹) · en-IN · India

---

## Table of Contents
1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Required Environment Variables](#required-environment-variables)
4. [Setup Instructions](#setup-instructions)
5. [Running the App](#running-the-app)
6. [Feature Matrix (Phase 1)](#feature-matrix-phase-1)
7. [Admin Portal — Screens](#admin-portal--screens)
8. [Third-Party Integrations](#third-party-integrations)
9. [Database Structure](#database-structure)
10. [Production Notes](#production-notes)

---

## Architecture

| Layer      | Stack |
|------------|-------|
| Backend    | FastAPI (Python 3.11) + Motor (async MongoDB) |
| Database   | MongoDB (single primary, multi-collection) |
| Admin Web  | Expo Router (React Native for Web) served at `/admin/*` |
| Auth       | JWT (HS256) + bcrypt · RBAC via `roles` collection |
| Payments   | UPI Intent · COD · PhonePe Standard Checkout |
| Delivery   | Enterprise Delivery Charge Engine with weight slabs, bulky charges, Google Maps-ready distance |

```
┌────────────────────────────────────────────────────┐
│                    Kubernetes Ingress              │
│   /  → :3000 (Expo)     /api/*  → :8001 (FastAPI)  │
└────────────────────────────────────────────────────┘
                │                    │
        ┌───────▼────────┐   ┌───────▼──────┐
        │  Expo Router   │   │   FastAPI    │
        │  (Admin Web)   │◄──►│  + Motor    │
        └────────────────┘   └───────┬──────┘
                                     │
                              ┌──────▼─────┐
                              │  MongoDB   │
                              └────────────┘
```

---

## Prerequisites

- Python 3.11+
- Node 18+ / Yarn (`packageManager` in `package.json` is source of truth)
- MongoDB 6+ (local or Atlas)
- (Optional) Google Maps API key with Distance Matrix enabled
- (Optional) PhonePe merchant credentials for real payments

---

## Required Environment Variables

Copy the example files and fill in values.

### Backend (`/app/backend/.env`)

See `backend/.env.example`. Required variable **names**:

| Variable                      | Notes |
|-------------------------------|-------|
| `MONGO_URL`                   | MongoDB connection string |
| `DB_NAME`                     | Database name (default `nedsstore`) |
| `JWT_SECRET_KEY`              | **Change in production.** Generate with `openssl rand -hex 32`. |
| `ACCESS_TOKEN_MINUTES`        | JWT lifetime (default `1440` = 24h) |
| `GOOGLE_MAPS_API_KEY`         | Leave `REPLACE_ME` for haversine fallback |
| `PHONEPE_ENV`                 | `UAT` (default) or `PROD` |
| `PHONEPE_MERCHANT_ID`         | PhonePe merchant id — placeholder mode if `REPLACE_ME` |
| `PHONEPE_CLIENT_ID`           | PhonePe client id |
| `PHONEPE_CLIENT_SECRET`       | PhonePe client secret |
| `PHONEPE_CLIENT_VERSION`      | Client version (default `1`) |
| `PHONEPE_SALT_KEY`            | PhonePe salt key |
| `PHONEPE_SALT_INDEX`          | Salt index (default `1`) |
| `PHONEPE_WEBHOOK_AUTH_MODE`   | `SHA` (default) |
| `PHONEPE_WEBHOOK_USERNAME`    | Webhook auth username |
| `PHONEPE_WEBHOOK_PASSWORD`    | Webhook auth password |
| `NEDS_SEED_DEMO_PAYMENTS`     | `1` to seed a demo UPI account on first run; unset in prod |

### Frontend (`/app/frontend/.env`)

See `frontend/.env.example`. Required variable **names**:

| Variable                    | Notes |
|-----------------------------|-------|
| `EXPO_PUBLIC_BACKEND_URL`   | Full URL of the FastAPI backend (no `/api` suffix) |
| `EXPO_PACKAGER_HOSTNAME`    | Managed by deploy infra |
| `EXPO_PACKAGER_PROXY_URL`   | Managed by deploy infra |
| `EXPO_TUNNEL_SUBDOMAIN`     | Managed by deploy infra |
| `EXPO_USE_FAST_RESOLVER`    | `1` for Metro speedup |
| `METRO_CACHE_ROOT`          | Metro cache directory |
| `EXPO_PUBLIC_DEMO_MODE`     | `1` in dev = login page pre-fills demo creds. Unset in prod. |

> ⚠️ **DO NOT commit real values.** The `.gitignore` already excludes `.env` files while keeping `.env.example` tracked.

---

## Setup Instructions

### 1. Clone & prepare env files

```bash
git clone <YOUR_REPO_URL> neds-store
cd neds-store
cp backend/.env.example backend/.env      # fill in values
cp frontend/.env.example frontend/.env    # fill in values
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Frontend

```bash
cd ../frontend
yarn install
```

### 4. Database

- **Local:** run MongoDB on default port `27017`.
- **Managed (Atlas):** set `MONGO_URL` to the connection string.

The backend seeds on first startup:
- Super Admin user (mobile `9999999999`, password `Admin@123`) — **change this password immediately in production.**
- 6 default categories
- Default business rules (delivery, commission, GST, rider pay)
- 7 system RBAC roles (super_admin, manager, staff_admin, staff, seller, rider, customer)

No manual migrations are needed — indexes and defaults are idempotent.

---

## Running the App

### Backend

```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Health check: `GET /api/health` → `{"status":"ok","db":"connected"}`

### Frontend

```bash
cd frontend
yarn expo start --web --port 3000
```

Admin Portal opens at `http://localhost:3000/login` (desktop optimised, `≥ 900px`).

### Behind the Emergent Kubernetes ingress

- `/` → port 3000 (Expo)
- `/api/*` → port 8001 (FastAPI)

Services are managed by supervisord (`sudo supervisorctl restart backend|expo`).

---

## Feature Matrix (Phase 1)

| # | Module | Status |
|---|--------|--------|
| 1 | Enterprise Delivery Charge Engine | ✅ |
| 2 | Payment Configuration Module | ✅ |
| 3 | Seller Financial Dashboard & Settlement | ✅ |
| 4 | Rider Dashboard & Settlement | ✅ |
| 5 | Rider Payment Model Configuration | ✅ |
| 6 | Staff Management & Salary | ✅ |
| 7 | Reports & Analytics | ✅ |
| 10 | RBAC — Roles & Permissions | ✅ |
| 11 | Delivery Zones & Service Areas | ✅ |
| 12 | Return / Refund / Cancellation Engine | ✅ |
| 13 | Audit Logs & Activity Monitoring | ✅ |
| 14 | System Configuration (Business Rules) | ✅ |
| 16 | Business Intelligence Dashboard | ✅ |
| 17 | Inventory & Stock Management | ✅ |
| 18 | Tax / GST Configuration | ✅ |
| 19 | Invoice & Billing Engine (with GST split) | ✅ |
| 20 | Customer Support Ticket Management | ✅ |
| 21 | Coupons / Offers / Promotions | ✅ |
| 22 | Inventory Audit & Stock Movement Logs | ✅ (integrated with Point 17) |
| 23 | Fraud Detection (heuristic, read-only) | ✅ |
| 24 | PhonePe Payment Gateway Integration | ✅ (placeholder mode until real creds set) |
| KYC | Seller/Rider onboarding & document review | ✅ |

Points 8, 9, 15 are intentionally deferred to Phase 2 (external providers required).

---

## Admin Portal — Screens

Sidebar sections:

- **Overview** — Dashboard
- **Operations** — Orders · Deliveries · Returns & Refunds · Delivery Logs
- **Catalog** — Products · Categories · Inventory · Coupons
- **Finance** — Payments · Payment Config · Invoices · Seller Earnings · Rider Earnings
- **People** — Users · Staff · KYC Verification · Roles & Permissions
- **Operations Intel** — Reports · Support Tickets · Delivery Zones · Fraud Alerts
- **Configuration** — Business Rules · Audit Logs

Every screen is backed by real REST endpoints — no mocked data.

---

## Third-Party Integrations

### Google Maps (Point 1 / Point 11)
- Add key via `GOOGLE_MAPS_API_KEY` env variable.
- Without a key, the delivery engine uses **haversine (straight-line) distance** as fallback.
- Delivery zone editor accepts lat/lng manually — map preview will activate when key is present.

### PhonePe Standard Checkout (Point 24)
- Set `PHONEPE_ENV=UAT` for sandbox / `PROD` for live.
- All 8 PhonePe env variables must be set to real values for live mode.
- With `REPLACE_ME` values, the gateway operates in **placeholder mode** — returns mock success responses but never touches real PhonePe servers.
- Webhook endpoint: `POST /api/payments/phonepe/webhook`

---

## Database Structure

Key collections (all documents use string `id` fields, not ObjectId):

| Collection             | Purpose |
|------------------------|---------|
| `users`                | Customers, sellers, riders, staff, admin |
| `roles`                | RBAC roles + permissions |
| `categories`           | Product categories + commission range |
| `products`             | Catalog with GST%, HSN, weight, stock |
| `orders`               | Full order lifecycle + delivery breakdown |
| `deliveries`           | Assigned deliveries + verification code |
| `delivery_verifications` | GPS audit trail per verified delivery |
| `payment_accounts`     | Company UPI/bank accounts |
| `payment_transactions` | PhonePe transactions + webhook history |
| `seller_earnings`      | Per-order seller earnings |
| `seller_settlements`   | Bundled seller payouts |
| `rider_earnings`       | Per-delivery rider earnings |
| `rider_settlements`    | Bundled rider payouts |
| `return_requests`      | Customer returns |
| `cancellation_requests`| Order cancellations |
| `refund_transactions`  | Refund ledger |
| `invoices`             | Auto-generated invoices with GST split |
| `coupons`              | Coupon definitions |
| `coupon_usage`         | Per-customer usage ledger |
| `staff_salaries`       | Staff salary payment history |
| `delivery_zones`       | Serviceable areas |
| `support_tickets`      | Customer/seller/rider tickets + messages |
| `stock_movements`      | Every inventory change with actor & reason |
| `business_rules`       | Singleton config (`id: "default"`) |
| `audit_logs`           | Immutable audit trail across all admin actions |

Indexes are created idempotently at backend startup (`db.py::create_indexes`).

---

## Production Notes

### Security checklist before going live

- [ ] Change Super Admin default password (`Admin@123`)
- [ ] Generate a strong `JWT_SECRET_KEY` (`openssl rand -hex 32`)
- [ ] Set `EXPO_PUBLIC_DEMO_MODE` to `0` or leave unset (removes demo creds hint on login)
- [ ] Unset `NEDS_SEED_DEMO_PAYMENTS` (no auto-seed of demo UPI)
- [ ] Provide real PhonePe credentials and set `PHONEPE_ENV=PROD`
- [ ] Provide real `GOOGLE_MAPS_API_KEY`
- [ ] Configure MongoDB with authentication and TLS
- [ ] Configure automated MongoDB backups (built-in Atlas backups recommended)
- [ ] Set up TLS/HTTPS on the ingress
- [ ] Review RBAC roles in `Admin → Roles & Permissions` and lock down `staff` role

### Known limitations

- **Point 8 (Notification Center):** Notifications are logged as audit events; a dedicated user-facing push/email system is scheduled for Phase 2.
- **Point 15 (Backup & Recovery):** Backup provider integration deferred to Phase 2 — for now, rely on MongoDB Atlas automated backups or `mongodump` cron.
- **PhonePe:** Runs in placeholder mode until real credentials are provided — no fake production successes are shown; the UI clearly indicates placeholder mode.
- **Google Maps:** Fallback to haversine distance until real key is provided — road distances will be slightly different.

### Deploying

This repo is designed to be deployed via the Emergent publish workflow (top-right Publish button in the Emergent editor). For self-hosted deployment:

1. Deploy the FastAPI backend behind an ingress that proxies `/api/*` to it on port 8001.
2. Deploy the Expo Web build (`yarn expo export --platform web`) as a static site.
3. Ensure MongoDB is reachable from the backend pod.
4. Set all environment variables through your platform's secret manager — **never bake secrets into images**.

---

## License

Proprietary — © 2026 Next Era Digital Solutions. All rights reserved.
