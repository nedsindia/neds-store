# NEDS STORE — SYSTEM ARCHITECTURE & INTEGRATION MASTER

**Project:** NEDS STORE
**Repository:** `nedsindia/neds-store`
**Status:** FINAL ARCHITECTURE BASELINE
**Purpose:** यह document तय करता है कि Customer Website, Customer App, Seller App, Rider App और Super Admin एक ही system में कैसे connected होकर काम करेंगे।

---

## 1. CORE ARCHITECTURE — FINAL

NEDS STORE में अलग-अलग apps के लिए अलग-अलग business logic नहीं बनाया जाएगा।

### Single Backend Principle

**एक ही central backend + एक ही production database** सभी clients को serve करेगा:

- Super Admin Web Portal
- Customer Public Website
- Customer Android App
- Seller Android App
- Rider Android App
- Staff functionality (जहाँ लागू हो)

सभी clients **same REST/API layer** के माध्यम से backend से बात करेंगे।

### Golden Rule

> UI अलग हो सकती है, लेकिन business logic एक ही जगह रहेगा।

इससे price, stock, order, payment, delivery charge, commission, refund, settlement, permissions आदि में अलग-अलग apps के कारण mismatch नहीं होगा।

---

# 2. SYSTEM FLOW

```text
                    NEDS STORE USERS
                          |
        +-----------------+------------------+
        |                 |                  |
   Customer            Seller              Rider
        |                 |                  |
   Website/App        Seller App          Rider App
        |                 |                  |
        +-----------------+------------------+
                          |
                    HTTPS / REST API
                          |
                  CENTRAL BACKEND
                          |
      +-------------------+-------------------+
      |                   |                   |
 Authentication      Business Logic       Notifications
 RBAC/Permissions     Order Engine         Payment Events
      |               Delivery Engine       Support
      |               Settlement Engine     Audit Logs
      +-------------------+-------------------+
                          |
                    DATA / STORAGE
                          |
              +-----------+-----------+
              |                       |
        MongoDB Database       Media/Object Storage
              |
      Users / Sellers / Riders
      Products / Inventory
      Orders / Payments
      Refunds / Settlements
      Zones / Coupons
      Notifications / Logs
```

---

# 3. CODEBASE STRUCTURE — FINAL PRINCIPLE

GitHub repository `nedsindia/neds-store` is the single development source.

Recommended logical structure:

```text
neds-store/
├── backend/
│   ├── routes/
│   ├── models/
│   ├── services/
│   ├── auth/
│   ├── business/
│   ├── notifications/
│   └── tests/
│
├── frontend/
│   ├── admin/          # Super Admin Web
│   ├── customer-web/   # Public Customer Website
│   └── shared/
│
├── apps/
│   ├── customer-app/
│   ├── seller-app/
│   └── rider-app/
│
├── docs/
├── scripts/
└── NEDS_STORE_MASTER.md
```

**Important:** Existing repository structure को पहले audit किया जाएगा। ऊपर की structure एक architectural target है; existing working folders को बिना audit/reason के rename या move नहीं करना है।

---

# 4. BACKEND — SINGLE SOURCE OF BUSINESS LOGIC

Backend में business rules centralize होंगे।

### Central services

- Authentication Service
- User/Roles Service
- Customer Service
- Seller Service
- Rider Service
- Product Service
- Category Service
- Inventory Service
- Cart/Checkout Service जहाँ server-side validation आवश्यक हो
- Order Service
- Delivery Zone Service
- Delivery Charge Service
- Dispatch Service
- Payment Service
- Refund/Cancellation Service
- Commission Service
- Seller Settlement Service
- Rider Earnings/Settlement Service
- Tax/GST Service
- Invoice Service
- Coupon/Promotion Service
- Notification Service
- Support/Ticket Service
- Audit Log Service
- Reports/Analytics Service

### Critical rule

Frontend कभी भी final price, delivery charge, commission, stock availability, payment state या authorization को स्वयं authoritative तरीके से decide नहीं करेगा।

Backend अंतिम निर्णय देगा।

---

# 5. DATABASE — SINGLE PRODUCTION DATABASE

### Primary database

**MongoDB / MongoDB Atlas** को central production database माना जाएगा, जब तक existing project audit किसी अलग finalized database को प्रमाणित न करे।

### Main data domains

- users
- roles / permissions
- customer_profiles
- addresses
- sellers
- seller_kyc
- shops
- riders
- rider_kyc
- staff
- products
- categories
- inventory
- stock_movements
- carts (यदि server-side persistence आवश्यक हो)
- orders
- order_items
- payments
- refunds
- delivery_zones
- delivery_charges
- rider_assignments
- commissions
- seller_settlements
- rider_settlements
- invoices
- taxes
- coupons
- promotions
- notifications
- support_tickets
- ratings_reviews
- audit_logs
- system_settings

### Database rules

1. एक ही production database सभी clients के लिए होगा।
2. Customer, Seller और Rider के लिए अलग-अलग duplicate databases नहीं होंगे।
3. Data ownership API authorization से enforce होगी।
4. Seller केवल अपना shop/product/order/settlement data देख सकेगा।
5. Rider केवल अपने assigned/eligible delivery data देख सकेगा।
6. Customer केवल अपना profile/address/order/payment-related data देख सकेगा।
7. Admin authorized global data access रखेगा।
8. Sensitive credentials database में plaintext में नहीं रखने हैं।

---

# 6. AUTHENTICATION & RBAC — SHARED

एक central authentication system होगा।

### Roles

- SUPER_ADMIN
- ADMIN/STAFF roles as finalized by RBAC
- SELLER
- RIDER
- CUSTOMER

### Login result

Backend authenticated user की identity और role के आधार पर access देगा।

Client routing अलग हो सकती है:

```text
CUSTOMER  → Customer Website/App
SELLER    → Seller App
RIDER     → Rider App
ADMIN     → Admin Portal
```

लेकिन authentication authority एक ही होगी।

### Security rule

सिर्फ frontend route hide करना security नहीं माना जाएगा। हर protected API endpoint पर server-side authorization जरूरी है।

---

# 7. CUSTOMER WEBSITE + CUSTOMER APP

दोनों customer clients होंगे और दोनों same backend APIs इस्तेमाल करेंगे।

### Shared customer capabilities

- Location
- Search
- Categories
- Products
- Cart
- Address
- Delivery zone validation
- Delivery charge
- Checkout
- UPI/COD
- Orders
- Tracking
- Cancellation
- Return/refund
- Rating/review
- Notifications
- Profile
- Support

### Difference

Website = browser UX

App = Android UX + mobile permissions + push notifications + mobile navigation

**Business logic duplicate नहीं होगा।**

---

# 8. SELLER APP INTEGRATION

Seller App उसी backend से:

```text
Seller Login
   ↓
RBAC
   ↓
Seller/Shop data
   ↓
Products + Inventory
   ↓
Incoming Orders
   ↓
Accept/Reject
   ↓
Prepare Order
   ↓
Ready for Pickup
   ↓
Rider Handover
   ↓
Settlement
```

Seller App में final commission calculation client-side नहीं होगा। Backend calculated settlement authoritative होगा।

---

# 9. RIDER APP + DISPATCH ENGINE

Rider App और Dispatch Engine tightly integrated होंगे।

```text
Order Ready
    ↓
Find eligible riders
    ↓
Zone / Pincode
    ↓
Service compatibility
    ↓
Availability
    ↓
Current workload
    ↓
Distance / ETA
    ↓
Ranking
    ↓
First rider request
    ↓
2-minute acceptance window
    ↓
Accepted? ── YES → Assignment locked
    |
    NO / TIMEOUT
    ↓
Next eligible rider
```

### Important

Assignment backend में होगा। Rider App सिर्फ request receive, accept/reject और status updates करेगा।

इससे कोई rider app खुद से order claim करके business rules bypass नहीं कर सकेगा।

---

# 10. ORDER AS SINGLE SYSTEM OBJECT

एक order की lifecycle सभी apps में एक ही backend state machine से चलेगी।

Example:

```text
CREATED
 ↓
PAYMENT_PENDING / COD_CONFIRMED
 ↓
SELLER_PENDING
 ↓
SELLER_ACCEPTED
 ↓
PREPARING
 ↓
READY_FOR_PICKUP
 ↓
RIDER_ASSIGNING
 ↓
RIDER_ASSIGNED
 ↓
PICKED_UP
 ↓
OUT_FOR_DELIVERY
 ↓
DELIVERED
```

Alternative terminal states:

```text
CANCELLED
RETURN_REQUESTED
RETURN_APPROVED
REFUND_PENDING
REFUNDED
REJECTED
```

हर state transition backend validate करेगा।

---

# 11. INVENTORY CONSISTENCY

Customer Website/App product stock दिखा सकते हैं, लेकिन final stock check backend करेगा।

### Rule

```text
Customer Add to Cart
        ↓
Backend stock validation
        ↓
Checkout
        ↓
Backend re-check stock
        ↓
Order creation
        ↓
Atomic/controlled stock update
```

Seller App inventory update करेगा, लेकिन customer order के समय backend authoritative रहेगा।

---

# 12. DELIVERY CHARGE CONSISTENCY

Delivery charge calculation एक central backend service से होगा।

Inputs:

- Customer location
- Seller location
- Delivery zone
- Distance
- Delivery type
- Weight
- Admin configuration

Outputs:

- Serviceable / not serviceable
- Delivery charge
- Estimated delivery mode/time

Customer Website, Customer App और Admin को अलग-अलग delivery formula नहीं बनाना है।

---

# 13. PAYMENT ARCHITECTURE

Payment selection customer clients में दिखाई जाएगी, लेकिन payment state backend में record होगी।

```text
Customer
 ↓
Checkout
 ↓
Backend creates order/payment intent as applicable
 ↓
UPI / COD
 ↓
Payment result
 ↓
Backend verifies/records status
 ↓
Order state updated
```

### Rules

- No secret payment credentials in frontend.
- No payment success based only on client-side callback.
- Payment/order reconciliation required.
- COD orders must follow the same central order lifecycle.

---

# 14. MEDIA / FILE STORAGE

Product images, KYC documents, invoices and other uploaded files को Git repository में store नहीं करना है।

Use:

- Object/media storage
- Secure URLs
- Access controls for private documents

KYC documents और sensitive files public नहीं होने चाहिए।

---

# 15. NOTIFICATIONS

Central Notification Service सभी clients को events देगा।

Examples:

- New order
- Seller order received
- Seller accepted
- Rider assigned
- Rider request
- Order picked up
- Out for delivery
- Delivered
- Payment result
- Refund update
- Settlement update
- Support response

Customer/Seller/Rider app notification channels अलग हो सकते हैं, लेकिन event source backend रहेगा।

---

# 16. LOCATION / GPS

### Customer
- Location permission
- GPS/manual address
- Pincode/serviceability

### Rider
- Location permission
- Online होने पर location updates
- Dispatch eligibility
- Delivery navigation

### Seller
- Shop location/address

### Rule

GPS location को केवल आवश्यक workflow में collect/use करना है। Permissions और privacy स्पष्ट रखनी है।

---

# 17. DEPLOYMENT ARCHITECTURE

Production में components logically अलग होंगे, भले ही एक repository में रहें।

### A. GitHub

Source code, version control, commits, branches और release history का source.

### B. Web hosting

Customer Public Website और Super Admin Web Portal को production web hosting पर deploy किया जाएगा। **Vercel preferred option** है यदि existing framework/build और backend requirements उसके साथ compatible हों।

### C. Backend hosting

Central API backend अलग deployable service के रूप में रहेगा। Vercel serverless deployment तभी इस्तेमाल होगा जब existing backend और long-running requirements compatible हों। GPS/dispatch workers, background jobs, persistent connections या long-running processes के लिए dedicated backend/worker hosting आवश्यक हो सकती है।

### D. Database

Production MongoDB Atlas.

### E. Media storage

Dedicated object/media storage.

### F. Mobile apps

Customer, Seller और Rider Android apps central production API URL से connect होंगी।

### G. Push notifications

Firebase Cloud Messaging या equivalent production notification service.

### H. Maps/location

Production maps/distance/geocoding provider with secured server-side configuration where applicable.

---

# 18. ENVIRONMENT SEPARATION

कम से कम:

```text
Development
Staging/Test
Production
```

हर environment के अलग secrets/configuration होंगे।

Production database और test database अलग रखने हैं।

---

# 19. SECRETS MANAGEMENT

इनमें से कोई भी GitHub source code में hard-code नहीं होगा:

- MongoDB URI
- JWT secret
- PhonePe credentials
- Payment secrets
- Maps API keys
- Firebase credentials
- Object storage credentials
- Admin passwords
- Other private keys

Use hosting/platform environment variables or secure secrets management.

---

# 20. CI/CD & RELEASE FLOW

Recommended flow:

```text
Developer change
      ↓
GitHub branch
      ↓
Code review / self-audit
      ↓
Tests
      ↓
Merge to main
      ↓
Build
      ↓
Staging verification
      ↓
Production deployment
      ↓
Smoke test
      ↓
Release FINAL
```

Small fixes may be committed directly to `main` only when safe and tested. Major modules should use a separate branch/PR workflow.

---

# 21. TESTING STRATEGY

Every major feature must be tested across the full chain:

```text
UI
 ↓
API
 ↓
Business Logic
 ↓
Database
 ↓
External Service (if any)
 ↓
Response
 ↓
UI State
```

### Example: Customer order

Customer App → API → Order Service → Inventory → Payment → Database → Seller notification → Dispatch → Rider App → Delivery → Settlement.

केवल screen खुलना COMPLETE नहीं माना जाएगा। End-to-end workflow functional होना चाहिए।

---

# 22. DATA OWNERSHIP RULES

### Customer
Own profile, addresses, own orders, own support, own reviews.

### Seller
Own shop, own products, own inventory, own orders assigned to shop, own settlement information.

### Rider
Own profile/KYC, own availability, own assigned delivery tasks, own earnings.

### Admin
Authorized platform-wide management.

### Backend
Final authority for business rules.

---

# 23. NO DUPLICATION RULE

निम्न logic अलग-अलग apps में duplicate नहीं किया जाएगा:

- Delivery charge formula
- Commission formula
- Tax calculation
- Refund rules
- Order state transitions
- Stock deduction
- Rider assignment
- Seller settlement
- Rider settlement
- Permission enforcement
- Payment status authority

इनका source backend services होंगे।

---

# 24. PRODUCTION READINESS CHECK

Production release से पहले:

- [ ] All clients use production API
- [ ] Database production configured
- [ ] Secrets configured securely
- [ ] CORS configured
- [ ] Authentication verified
- [ ] RBAC verified
- [ ] Payment verified
- [ ] Delivery zones verified
- [ ] GPS verified
- [ ] Dispatch verified
- [ ] Inventory consistency verified
- [ ] Order lifecycle verified
- [ ] Refund verified
- [ ] Settlement verified
- [ ] Notifications verified
- [ ] Media storage verified
- [ ] Backup/recovery verified
- [ ] Logs/monitoring verified
- [ ] Security audit completed
- [ ] Mobile builds tested
- [ ] Website tested
- [ ] Admin regression test completed

---

# 25. ARCHITECTURE LOCK

**FINAL ARCHITECTURE DECISION:**

1. GitHub is the primary codebase.
2. One central backend/business-logic layer.
3. One production database.
4. Five user-facing products/components: Super Admin Web, Customer Website, Customer App, Seller App, Rider App.
5. All clients use the same backend APIs and shared business rules.
6. Admin panel remains protected and is not to be broken while building customer/seller/rider products.
7. Production deployment is separated logically into web, API, database, storage and mobile delivery components.
8. No duplicate business logic across clients.
9. Every feature is tested end-to-end before FINAL status.
10. Master Project File remains the primary feature/status tracker; this architecture file is its technical integration baseline.
