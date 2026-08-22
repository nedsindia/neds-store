# NEDS STORE — MASTER PROJECT FILE

**Project:** NEDS STORE
**Company:** Next Era Digital Solutions (NEDS)
**Repository:** `nedsindia/neds-store`
**Primary source of truth:** GitHub
**Version target:** V1.0 Production
**Master status:** ACTIVE
**Last updated:** 22 August 2026

---

## 1. MASTER RULE

यह file NEDS STORE के पूरे development का **Single Source of Truth** है।

### Status
- **FINAL** = implementation + required testing/verification complete.
- **IN PROGRESS** = development चल रहा है.
- **PENDING** = अभी development बाकी है.
- **VERIFY** = code/UI मौजूद है लेकिन functional verification बाकी है.
- **BLOCKED** = dependency के कारण रुका हुआ.

### Development rules
1. FINAL feature को बिना आवश्यकता के बदलना/हटाना नहीं है।
2. Existing working functionality preserve करनी है।
3. नया feature जोड़ने से पहले Master File में उसका scope स्पष्ट करना है।
4. Implementation के बाद testing करनी है।
5. Testing सफल होने पर ही FINAL mark करना है।
6. हर major milestone के बाद GitHub commit/push करना है।
7. Secrets, passwords, API keys और production credentials repository में commit नहीं करने हैं।
8. कोई बड़ा architecture change बिना Master File update के नहीं करना है।

---

# 2. CURRENT OVERALL STATUS

| Module | Status |
|---|---|
| Super Admin Panel | **FINAL** |
| Customer Public Website | **PENDING** |
| Customer App | **PENDING** |
| Seller App | **PENDING** |
| Rider App | **PENDING** |
| Backend/API | **VERIFY / CONTINUOUS** |
| Database | **VERIFY / CONTINUOUS** |
| Production Deployment | **PENDING** |

---

# 3. SUPER ADMIN PANEL — FINAL

**Status: FINAL**

The existing Super Admin Panel is the approved baseline. आगे के काम में इसे बिना आवश्यकता के redesign या break नहीं करना है।

### Final scope
- [x] Dashboard
- [x] Authentication
- [x] RBAC / Roles & Permissions
- [x] Customer Management
- [x] Seller Management baseline
- [x] Rider Management baseline
- [x] Staff Management baseline
- [x] Product Management
- [x] Category Management
- [x] Inventory / Stock Management
- [x] Order Management
- [x] Delivery Zone / Service Area configuration
- [x] Delivery charge configuration baseline
- [x] Commission configuration baseline
- [x] Return / Refund / Cancellation engine baseline
- [x] Settlement baseline
- [x] Existing admin workflows preserved

### Known items to verify during GitHub audit
- [ ] Invoice/Tax integration
- [ ] Reports/Analytics depth
- [ ] Coupon/Offers UI
- [ ] Seller KYC workflow depth
- [ ] Rider onboarding depth
- [ ] Staff dedicated screens
- [ ] Payment gateway production configuration
- [ ] Google Maps production distance API
- [ ] Seed/demo data cleanup

> These verification items do not change the declaration that the existing Super Admin Panel is the finalized baseline. They are follow-up audit items before production release.

---

# 4. CUSTOMER PUBLIC WEBSITE — PENDING

**Goal:** Customer-facing web marketplace using the existing backend/business logic. Admin remains separate.

## A. Public entry & layout
- [ ] `/` customer home
- [ ] Responsive desktop/tablet/mobile layout
- [ ] NEDS STORE branding
- [ ] Header/navigation
- [ ] Search
- [ ] Categories navigation
- [ ] Cart indicator
- [ ] Login/Register controls
- [ ] Footer
- [ ] Help/Support access

## B. Customer authentication
- [ ] Customer registration
- [ ] Mobile + password login
- [ ] Logout
- [ ] Session persistence
- [ ] Customer-only access protection
- [ ] Profile access

## C. Home page
- [ ] Hero/banner section
- [ ] Categories
- [ ] Featured products
- [ ] Deals/offers
- [ ] Trending/popular products
- [ ] Nearby/serviceable products where applicable
- [ ] Location/serviceability prompt

## D. Product discovery
- [ ] All products
- [ ] Category pages
- [ ] Search results
- [ ] Filters
- [ ] Sort
- [ ] Product cards
- [ ] Product details
- [ ] Product images
- [ ] Price/availability
- [ ] Related products

## E. Location & delivery availability
- [ ] Request location permission where appropriate
- [ ] GPS location
- [ ] Manual address
- [ ] Pincode validation
- [ ] Delivery-zone validation
- [ ] Inside active zone → service available
- [ ] Outside active zone → unavailable message
- [ ] No active zone → coming-soon message

## F. Cart
- [ ] Add product
- [ ] Remove product
- [ ] Increase/decrease quantity
- [ ] Stock validation
- [ ] Seller/product consistency rules
- [ ] Coupon input
- [ ] Coupon validation
- [ ] Delivery charge preview
- [ ] Order total

## G. Checkout
- [ ] Address selection
- [ ] Add/edit address
- [ ] Delivery type selection
- [ ] Delivery charge calculation
- [ ] Weight-based charge where applicable
- [ ] UPI payment selection
- [ ] COD selection
- [ ] Order summary
- [ ] Place order
- [ ] Payment result handling

## H. Orders
- [ ] Order history
- [ ] Order detail
- [ ] Status timeline
- [ ] Seller status
- [ ] Rider status
- [ ] Pickup/delivery status
- [ ] Tracking
- [ ] Cancel order
- [ ] Return request
- [ ] Refund request
- [ ] Rating/review

## I. Customer account
- [ ] Profile
- [ ] Address book
- [ ] Order history
- [ ] Saved account details
- [ ] Notifications
- [ ] Support/contact

## J. Support & legal
- [ ] Help
- [ ] Contact/support option
- [ ] Customer issue reporting
- [ ] Terms
- [ ] Privacy Policy
- [ ] Refund/Cancellation Policy

## K. Website production QA
- [ ] Desktop QA
- [ ] Mobile QA
- [ ] Search QA
- [ ] Cart QA
- [ ] Checkout QA
- [ ] Order QA
- [ ] Location QA
- [ ] Payment QA
- [ ] Error-state QA
- [ ] Performance QA
- [ ] Final production readiness

---

# 5. CUSTOMER APP — PENDING

**Goal:** Dedicated customer mobile app.

## A. Startup
- [ ] Splash screen
- [ ] Location permission request on first relevant launch
- [ ] Login/Register
- [ ] Serviceability/location check

## B. Home
- [ ] Location selector
- [ ] Search
- [ ] Categories
- [ ] Banners
- [ ] Featured products
- [ ] Deals/offers
- [ ] Trending products
- [ ] Nearby/serviceable products

## C. Product
- [ ] Product listing
- [ ] Category listing
- [ ] Search
- [ ] Filter
- [ ] Sort
- [ ] Product detail
- [ ] Image gallery
- [ ] Price/stock
- [ ] Related products
- [ ] Add to cart

## D. Cart & checkout
- [ ] Cart
- [ ] Quantity control
- [ ] Remove item
- [ ] Coupon
- [ ] Address
- [ ] GPS/manual location
- [ ] Delivery zone validation
- [ ] Delivery charge
- [ ] Delivery type
- [ ] UPI
- [ ] COD
- [ ] Place order

## E. Order management
- [ ] Order confirmation
- [ ] Order history
- [ ] Order detail
- [ ] Live status/tracking
- [ ] Cancel
- [ ] Return
- [ ] Refund
- [ ] Rating/review

## F. Account
- [ ] Profile
- [ ] Address book
- [ ] Notifications
- [ ] Help/support
- [ ] Contact option
- [ ] Logout

## G. Mobile quality
- [ ] Android UI QA
- [ ] Permission handling
- [ ] Network error handling
- [ ] Loading/empty states
- [ ] Crash/error testing
- [ ] Production build

---

# 6. SELLER APP — PENDING

**Goal:** Dedicated seller/shop management app.

## A. Seller onboarding
- [ ] Seller registration
- [ ] Mobile/password login
- [ ] Shop details
- [ ] Owner details
- [ ] KYC document upload
- [ ] Bank/payment settlement details
- [ ] Admin approval status

## B. Seller dashboard
- [ ] Sales summary
- [ ] Orders summary
- [ ] Pending orders
- [ ] Inventory summary
- [ ] Earnings/settlement summary
- [ ] Notifications

## C. Shop management
- [ ] Shop profile
- [ ] Shop name/details
- [ ] Address/location
- [ ] Open/closed/availability status
- [ ] Service area visibility

## D. Product management
- [ ] Add product
- [ ] Edit product
- [ ] Delete/deactivate product
- [ ] Product image upload
- [ ] Category
- [ ] Price
- [ ] Discount
- [ ] Stock
- [ ] SKU/identifier where applicable
- [ ] Product availability

## E. Inventory
- [ ] Stock quantity
- [ ] Stock increase/decrease
- [ ] Low-stock alert
- [ ] Stock movement
- [ ] Inventory history

## F. Orders
- [ ] New order notification
- [ ] View order
- [ ] Accept
- [ ] Reject/cancel according to rules
- [ ] Preparation status
- [ ] Ready for pickup
- [ ] Rider handover
- [ ] Order history

## G. Settlement
- [ ] Sales amount
- [ ] Commission deduction
- [ ] Net seller amount
- [ ] Settlement history
- [ ] Settlement status
- [ ] Bank/payment details

## H. Seller support
- [ ] Notifications
- [ ] Support/chat/contact
- [ ] Issue reporting
- [ ] Help

## I. Security
- [ ] Seller-only authorization
- [ ] Seller can access only own shop/data
- [ ] Session/logout
- [ ] Sensitive data protection

---

# 7. RIDER APP — PENDING

**Goal:** Dedicated delivery/rider app with automatic dispatch support.

## A. Rider onboarding
- [ ] Rider registration
- [ ] Mobile/password login
- [ ] Profile
- [ ] KYC
- [ ] Vehicle details
- [ ] Driving/document verification
- [ ] Admin approval
- [ ] Bank/payment details

## B. Availability & GPS
- [ ] Online/offline toggle
- [ ] Location permission
- [ ] Continuous/appropriate GPS updates while online
- [ ] Service-area awareness
- [ ] Location privacy controls

## C. Dispatch engine integration
- [ ] Nearby rider detection
- [ ] Same-zone/pincode preference
- [ ] Service compatibility
- [ ] Current workload
- [ ] ETA/distance ranking
- [ ] Rating/experience factors where configured
- [ ] First eligible rider request
- [ ] 2-minute acceptance window
- [ ] Automatic next-rider fallback
- [ ] No duplicate assignment

## D. Order workflow
- [ ] Incoming request
- [ ] Accept
- [ ] Reject/timeout
- [ ] Pickup location
- [ ] Navigation
- [ ] Pickup confirmation
- [ ] Customer destination
- [ ] Delivery navigation
- [ ] Delivery confirmation
- [ ] Proof of delivery where required

## E. Active orders
- [ ] Active order list
- [ ] Maximum active-order/workload rule
- [ ] Order status
- [ ] Customer contact option
- [ ] Seller contact option where permitted
- [ ] Support option

## F. Earnings
- [ ] Delivery earnings
- [ ] Charge/earning breakdown
- [ ] Settlement history
- [ ] Pending/paid status
- [ ] Earnings reports

## G. Rider support
- [ ] Notifications
- [ ] Help
- [ ] Contact/support
- [ ] Issue reporting
- [ ] Emergency/support workflow if approved later

---

# 8. SHARED BUSINESS FEATURES — PENDING/VERIFY

- [ ] Customer/Seller/Rider/Staff RBAC
- [ ] Authentication
- [ ] Authorization
- [ ] User profiles
- [ ] Notifications
- [ ] Audit logs
- [ ] Error logging
- [ ] API validation
- [ ] Database integrity
- [ ] Rate/security controls
- [ ] Backup/recovery

---

# 9. PAYMENT — V1.0 REQUIREMENTS

- [ ] UPI intent/deep-link flow
- [ ] Google Pay
- [ ] PhonePe
- [ ] Paytm
- [ ] BHIM/other UPI apps
- [ ] COD
- [ ] Payment success/failure/cancel handling
- [ ] Payment/order reconciliation
- [ ] No Razorpay in V1.0
- [ ] No Stripe in V1.0

**Production credentials are to be configured only through secure environment/secrets management.**

---

# 10. DELIVERY & ZONE ENGINE

- [ ] Admin-configurable zones
- [ ] Pincode/service-area mapping
- [ ] GPS serviceability
- [ ] Minimum delivery charge ₹20
- [ ] ₹7/km after minimum distance rule as finalized
- [ ] Weight-based charge
- [ ] Instant delivery 1–2 hours
- [ ] Courier delivery 4–7 days
- [ ] Rider eligibility
- [ ] Dispatch ranking
- [ ] Rider timeout/fallback
- [ ] Customer-facing serviceability message

---

# 11. COMMISSION & SETTLEMENT

- [ ] Configurable 5%–30% commission
- [ ] Seller commission calculation
- [ ] Rider earning calculation
- [ ] Order-wise settlement
- [ ] Seller settlement history
- [ ] Rider settlement history
- [ ] Admin settlement controls
- [ ] Settlement reconciliation

---

# 12. RETURN / REFUND / CANCELLATION

- [ ] Customer cancellation
- [ ] Seller rejection/cancellation rules
- [ ] Instant Delivery return/refund request within 24 hours
- [ ] Courier Delivery return/refund request within 4 days
- [ ] Admin verification
- [ ] Refund status
- [ ] Order status synchronization
- [ ] Payment/refund reconciliation

---

# 13. TAX / INVOICE / BILLING

- [ ] GST/tax calculation
- [ ] Invoice generation
- [ ] Invoice storage/access
- [ ] Invoice linked to order
- [ ] Seller/customer invoice visibility
- [ ] Tax reporting
- [ ] Production API/router verification

---

# 14. REPORTS & ANALYTICS

- [ ] Sales dashboard
- [ ] Orders report
- [ ] Seller report
- [ ] Rider report
- [ ] Customer report
- [ ] Inventory report
- [ ] Commission report
- [ ] Settlement report
- [ ] Refund report
- [ ] Tax/GST report
- [ ] Export/download
- [ ] Business intelligence dashboard

---

# 15. SUPPORT / NOTIFICATIONS / PROMOTIONS

- [ ] Notification center
- [ ] Customer support/tickets
- [ ] Seller support
- [ ] Rider support
- [ ] Admin support management
- [ ] Coupon management
- [ ] Offers/promotions
- [ ] Banner management
- [ ] Promotional visibility rules

---

# 16. SECURITY / AUDIT / RECOVERY

- [ ] RBAC
- [ ] Permission enforcement at API level
- [ ] Input validation
- [ ] Secure password hashing
- [ ] JWT/session security
- [ ] Audit logs
- [ ] Admin action logs
- [ ] Payment security
- [ ] Secret management
- [ ] Backup
- [ ] Recovery procedure
- [ ] Fraud/risk controls

---

# 17. GITHUB DEVELOPMENT WORKFLOW

1. GitHub repository `nedsindia/neds-store` is the development source.
2. Work should be done in controlled milestones.
3. Before coding a module, review this Master File.
4. Preserve every FINAL feature.
5. After implementation, test the complete workflow.
6. Update this file with the actual status.
7. Commit and push the completed milestone.
8. Never commit secrets.

---

# 18. CURRENT PRIORITY ORDER

### Priority 1
**Super Admin Panel — FINAL / PROTECTED**

### Priority 2
**Customer Public Website — PENDING**

### Priority 3
**Customer App — PENDING**

### Priority 4
**Seller App — PENDING**

### Priority 5
**Rider App — PENDING**

### Priority 6
**Full integration + end-to-end QA — PENDING**

### Priority 7
**Production deployment — PENDING**

---

# 19. COMPLETION LOG

| Date | Milestone | Status |
|---|---|---|
| 22 Aug 2026 | GitHub repository established | FINAL |
| 22 Aug 2026 | Current NEDS STORE code pushed to GitHub | FINAL |
| 22 Aug 2026 | Super Admin Panel accepted as finalized baseline | FINAL |
| 22 Aug 2026 | Customer Public Website scope defined | PENDING |
| 22 Aug 2026 | Customer App scope defined | PENDING |
| 22 Aug 2026 | Seller App scope defined | PENDING |
| 22 Aug 2026 | Rider App scope defined | PENDING |
| 22 Aug 2026 | Master Project File created | FINAL |

---

# 20. FINAL LOCK POLICY

जब कोई section पूरी तरह implement + test हो जाए:

**PENDING → IN PROGRESS → VERIFY → FINAL**

FINAL होने के बाद उस feature को **FINAL LOCK** माना जाएगा।

इस Master File को हर major milestone के बाद update करना अनिवार्य है।

---

## NEXT TASK

**GitHub codebase का full technical audit करें और existing implementation को इस Master File के against map करें।**

Audit के बाद केवल वास्तविक स्थिति के आधार पर status बदलें। अनुमान लगाकर किसी feature को FINAL न करें।
