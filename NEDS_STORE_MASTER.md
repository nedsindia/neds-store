# NEDS STORE — MASTER PROJECT FILE

**Project:** NEDS STORE  
**Company:** Next Era Digital Solutions (NEDS)  
**Repository:** `nedsindia/neds-store`  
**Primary source of truth:** GitHub  
**Version target:** V1.0 Production  
**Master status:** ACTIVE  
**Last updated:** 22 August 2026

---

# 1. MASTER RULE

यह file NEDS STORE के पूरे development का **Single Source of Truth** है।

### Status
- **FINAL** = implementation + required testing/verification complete.
- **IN PROGRESS** = development चल रहा है.
- **PENDING** = अभी development बाकी है.
- **VERIFY** = code/UI मौजूद है लेकिन functional verification बाकी है.
- **BLOCKED** = dependency के कारण रुका हुआ.

### Permanent development rules
1. FINAL feature को बिना आवश्यकता के बदलना/हटाना नहीं है।
2. Existing working functionality preserve करनी है।
3. नया feature जोड़ने से पहले Master File में उसका scope स्पष्ट करना है।
4. **Coding से पहले इस Master File और System Architecture & Integration Master को पढ़ना अनिवार्य है।**
5. Actual GitHub code देखकर ही implementation करना है; अनुमान से coding नहीं करनी है।
6. Implementation के बाद local/staging में functional testing करनी है।
7. Testing सफल होने पर ही feature/module को **FINAL** mark करना है।
8. Completed feature का status इसी Master File में तुरंत update करना है।
9. हर बड़े milestone के बाद GitHub commit/push करना है।
10. Secrets, passwords, API keys और production credentials repository में commit नहीं करने हैं।
11. कोई बड़ा architecture change बिना Master File और Architecture document update के नहीं करना है।

---

# 2. CURRENT OVERALL STATUS

| Module | Status |
|---|---|
| Super Admin Panel | **FINAL** |
| Customer Public Website | **IN PROGRESS** |
| Customer App | **PENDING** |
| Seller App | **PENDING** |
| Rider App | **PENDING** |
| Backend/API | **VERIFY / CONTINUOUS** |
| Database | **VERIFY / CONTINUOUS** |
| Production Deployment | **PENDING** |

### 22 August 2026 implementation checkpoint
Customer Public Website का GitHub implementation baseline अब मौजूद है, जिसमें public home, header/search, product discovery, category/product detail, customer login/register, cart, addresses, checkout, orders, profile और help/legal pages शामिल हैं। यह **FINAL नहीं** है क्योंकि local/staging end-to-end verification अभी बाकी है।

एक audit में checkout/order integrity का critical issue मिला और server-authoritative pricing, customer identity और atomic stock reservation लागू किए गए। इस बदलाव का functional verification अभी **VERIFY pending** है।

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

---

# 4. CUSTOMER PUBLIC WEBSITE — IN PROGRESS

**Goal:** Customer-facing web marketplace using the existing backend/business logic. Admin remains separate.

### GitHub implementation checkpoint — 22 Aug 2026
Implemented in the current development branch, but **not FINAL until local/staging QA passes**:
- [x] Public home baseline
- [x] Public header/navigation/search baseline
- [x] Product listing/search/filter/sort baseline
- [x] Category and product detail baseline
- [x] Customer registration/login baseline
- [x] Cart baseline with persistent client storage
- [x] Address management baseline
- [x] Checkout/order baseline
- [x] Order history/detail baseline
- [x] Customer profile/password baseline
- [x] Help and legal pages baseline
- [ ] Full end-to-end functional verification

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

# 17. LOCAL DEVELOPMENT & VERIFICATION WORKFLOW — PERMANENT RULE

यह workflow हर नए module/feature के लिए लागू होगा। Production पर सीधे test करके development आगे नहीं बढ़ाया जाएगा।

## A. Source
1. Latest approved code GitHub repository `nedsindia/neds-store` से लिया जाएगा।
2. Coding से पहले Master File और System Architecture document review किए जाएंगे।
3. Actual codebase देखकर existing functionality preserve की जाएगी।

## B. Local environment
1. Backend local environment में चलाया जाएगा।
2. Frontend/web local environment में चलाया जाएगा।
3. यदि mobile app है तो local Android emulator या test device पर चलाया जाएगा।
4. Required local environment variables/secrets secure तरीके से configure किए जाएंगे; उन्हें GitHub में commit नहीं किया जाएगा।

## C. Feature-level testing
हर completed feature को केवल UI देखकर complete नहीं माना जाएगा। निम्न स्तर पर test किया जाएगा:

**Frontend/UI → API → Backend Business Logic → Database → Response → UI**

उदाहरण: Cart में product add होने पर केवल screen पर item दिखना पर्याप्त नहीं है; stock, seller rules, totals और backend response भी verify होंगे।

## D. Manual functional test
हर module के लिए:
- [ ] Happy path
- [ ] Invalid input
- [ ] Authentication/authorization
- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Network failure handling
- [ ] Boundary/edge cases
- [ ] Data persistence

## E. End-to-end testing
जहाँ feature दूसरे modules से जुड़ा है, पूरा workflow local/staging environment में test होगा। उदाहरण:

**Customer → Cart → Checkout → Payment/COD → Order → Seller → Rider → Pickup → Delivery → Settlement**

किसी एक screen के सही दिखने पर पूरा workflow COMPLETE नहीं माना जाएगा।

## F. Verification status
Testing के बाद:

`PENDING → IN PROGRESS → VERIFY`

यदि सभी आवश्यक checks पास हों:

`VERIFY → FINAL`

यदि bug मिले:

`VERIFY → IN PROGRESS`

Bug fix के बाद फिर से relevant tests चलेंगे।

## G. GitHub milestone
Feature/module के VERIFY/FINAL होने के बाद:

**Local/Stage Test → Review → Master File Status Update → Git Commit → GitHub Push**

GitHub में commit/push होने से पहले feature को FINAL घोषित नहीं किया जाएगा, जब तक testing और status update पूरा न हो।

## H. Production readiness
पूरे product को production में ले जाने से पहले अलग Full QA होगा:
- [ ] Frontend QA
- [ ] Backend/API QA
- [ ] Database QA
- [ ] Authentication/RBAC QA
- [ ] Payment QA
- [ ] Delivery/GPS QA
- [ ] Order lifecycle QA
- [ ] Seller/Rider/Customer integration QA
- [ ] Security QA
- [ ] Performance QA
- [ ] Mobile QA
- [ ] Backup/recovery QA
- [ ] Production configuration audit

---

# 18. GITHUB DEVELOPMENT WORKFLOW

1. GitHub repository `nedsindia/neds-store` is the development source.
2. Work should be done in controlled milestones.
3. Before coding a module, review this Master File.
4. Preserve every FINAL feature.
5. After implementation, test the complete workflow locally/staging.
6. Update this file with the actual status.
7. Commit and push the completed milestone.
8. Never commit secrets.

---

# 19. CURRENT PRIORITY ORDER

### Priority 1 — GitHub baseline verification
- [ ] Full repository audit
- [ ] Backend audit
- [ ] Database audit
- [ ] API audit
- [ ] Existing Super Admin preservation check

### Priority 2 — Customer Public Website — IN PROGRESS
- [x] Initial implementation baseline exists in GitHub development branch
- [ ] Complete remaining section-4 features
- [ ] Integrate existing backend/business logic completely
- [ ] Local functional testing
- [ ] End-to-end testing
- [ ] Mark verified features FINAL

### Priority 3 — Customer App
- [ ] Implement according to section 5
- [ ] Reuse central APIs/business logic
- [ ] Local Android testing
- [ ] End-to-end testing
- [ ] Mark verified features FINAL

### Priority 4 — Seller App
- [ ] Implement according to section 6
- [ ] Integrate seller/order/inventory/settlement APIs
- [ ] Local Android testing
- [ ] End-to-end testing
- [ ] Mark verified features FINAL

### Priority 5 — Rider App
- [ ] Implement according to section 7
- [ ] Integrate GPS/dispatch/order APIs
- [ ] Local Android testing
- [ ] End-to-end testing
- [ ] Mark verified features FINAL

### Priority 6 — Full Integration & Production
- [ ] Customer ↔ Seller ↔ Rider ↔ Admin integration
- [ ] Payment integration
- [ ] Delivery engine
- [ ] Settlement
- [ ] Notifications
- [ ] Full QA
- [ ] Deployment

---

# 20. COMPLETION LOG

| Date | Milestone | Status |
|---|---|---|
| 09 Jul 2026 | NEDS STORE SRS Parts 1–9 completed | FINAL |
| 09 Jul 2026 | V1.0 core business rules finalized | FINAL |
| 22 Aug 2026 | GitHub repository baseline established | FINAL |
| 22 Aug 2026 | Existing project code pushed to GitHub | FINAL |
| 22 Aug 2026 | Future development moved to GitHub workflow | FINAL |
| 22 Aug 2026 | Local testing/verification workflow added | FINAL |
| 22 Aug 2026 | Customer Public Website implementation baseline | IN PROGRESS |
| 22 Aug 2026 | Checkout/order server-authority + atomic stock security fix | VERIFY |

---

# 21. MASTER COMPLETION RULE

> **जो FINAL है उसे सुरक्षित रखें।**  
> **जो VERIFY है उसे पहले जांचें।**  
> **जो PENDING है उसे एक-एक करके पूरा करें।**  
> **Local/Stage में पूरा workflow test करें।**  
> **Testing सफल होने के बाद Master File में status FINAL करें।**  
> **फिर GitHub commit/push करें।**

**No guess-based coding. No silent architecture changes. No production-first testing.**
