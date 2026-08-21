# NEDS STORE — Product Requirements Document

## Brand
- Name: **NEDS STORE** (Next Era Digital Solutions)
- Tagline: **Learn • Grow • Succeed**
- Colors: Enterprise Green (#059669) primary, Black (#09090B) surfaces, White (#FFFFFF) background
- Currency / Locale: INR (₹) · en-IN · India
- Android package name: `com.nedsstore.app` (Phase 2)

## Phase 1 — ✅ COMPLETE

### Foundation
- **Backend:** FastAPI + MongoDB (Motor), modular routers, idempotent seed, JWT+bcrypt auth, RBAC
- **Admin Web:** Expo Router (React Native for Web) served at `/admin/*`, section-grouped sidebar
- **Auth:** Super Admin (mobile `9999999999`, password `Admin@123`) — CHANGE IN PRODUCTION

### 22 Enterprise Modules Delivered

| # | Module | Backend | Admin UI | Status |
|---|--------|---------|----------|--------|
| 1 | Enterprise Delivery Charge Engine | ✅ | `/admin/rules` | ✅ |
| 2 | Enterprise Payment Configuration | ✅ | `/admin/payment-config` | ✅ |
| 3 | Seller Financial Dashboard & Settlement | ✅ | `/admin/seller-earnings` | ✅ |
| 4 | Rider Dashboard & Settlement | ✅ | `/admin/rider-earnings` | ✅ |
| 5 | Rider Payment Model Configuration | ✅ | `/admin/rules` | ✅ |
| 6 | Staff Management & Salary | ✅ | `/admin/staff` | ✅ |
| 7 | Reports & Analytics | ✅ | `/admin/reports` | ✅ |
| 10 | RBAC — Roles & Permissions | ✅ | `/admin/rbac` | ✅ |
| 11 | Delivery Zones & Service Areas | ✅ | `/admin/zones` | ✅ |
| 12 | Return / Refund / Cancellation Engine | ✅ | `/admin/returns` | ✅ |
| 13 | Audit Logs & Activity Monitoring | ✅ | `/admin/audit` | ✅ |
| 14 | System Configuration | ✅ | `/admin/rules` | ✅ |
| 16 | Business Intelligence Dashboard | ✅ | `/admin/dashboard` + `/admin/reports` | ✅ |
| 17 | Inventory & Stock Management | ✅ | `/admin/inventory` | ✅ |
| 18 | Tax / GST Configuration | ✅ | `/admin/rules` (GST section) | ✅ |
| 19 | Invoice & Billing Engine (with GST split) | ✅ | `/admin/invoices` | ✅ |
| 20 | Customer Support & Ticket Management | ✅ | `/admin/tickets` | ✅ |
| 21 | Coupons / Offers / Promotions | ✅ | `/admin/coupons` | ✅ |
| 22 | Inventory Audit & Stock Movement Logs | ✅ | `/admin/inventory` (Movements tab) | ✅ |
| 23 | Fraud Detection (heuristic, read-only) | ✅ | `/admin/fraud` | ✅ |
| 24 | PhonePe Payment Gateway | ✅ | `/admin/payment-config` | ✅ (placeholder mode) |
| KYC | Seller/Rider Onboarding & KYC Review | ✅ | `/admin/kyc` | ✅ |

Points 8 (Notifications), 9 (Unified Settlement Center), 15 (Backup Provider) are deferred to Phase 2 (require external providers or duplicate existing capability).

## Final Regression — ✅ All Endpoints Pass
37 endpoints verified: auth, rbac, catalog, orders, deliveries, payments, invoices, coupons, staff, zones, tickets, reports, fraud, returns, cancellations, refunds, inventory, kyc, settlements, audit.

## Environment
- Backend: `/api/*` → port 8001. Bind `0.0.0.0:8001`.
- Frontend: Expo Router at port 3000.
- Env vars documented in `backend/.env.example` and `frontend/.env.example`.
- **No secrets committed.** `.gitignore` excludes all `.env` files.

## Production Readiness Checklist
- [x] No hardcoded secrets in code
- [x] Demo credentials only visible when `EXPO_PUBLIC_DEMO_MODE=1`
- [x] Demo bank account only seeded when `NEDS_SEED_DEMO_PAYMENTS=1`
- [x] Payment accounts enforce single-primary invariant at startup
- [x] Settlement errors logged (not silently swallowed)
- [x] Invoice auto-generation on delivery-verify
- [x] All admin actions write to `audit_logs`
- [x] `.env.example` + comprehensive `README.md` for GitHub migration
- [ ] Real PhonePe credentials (user action)
- [ ] Real Google Maps API key (user action)
- [ ] Change Super Admin password (user action)
- [ ] Generate production JWT_SECRET_KEY (user action)

## Phase 2 (planned)
- Single Android app (`com.nedsstore.app`) with 4 role panels (Customer / Seller / Rider / Staff)
- UPI Intent + COD checkout UI
- Google Maps navigation for riders
- Delivery Verification Code UI
- Native push notifications
- Enhanced backup provider integration
