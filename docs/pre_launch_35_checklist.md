# Complete 35-Item Pre-Launch Vulnerability & Compliance Checklist
*Archived from classifiedlearn.com/launch for offline & permanent reference*

---

## Pillar 01: Data & Privacy (10 Items)

| # | Checklist Item | Requirement & Standard | Verification Criteria |
|---|---|---|---|
| **01** | **Privacy policy published and linked** | Must be accessible within 1 click from anywhere in the app/site. | Linked in global footer, user account page, and checkout review step. |
| **02** | **Clear declaration of data scope** | Explicitly describe what data is collected, why, and who receives it. | Details customer names, phone numbers, addresses, custom text, and uploaded artwork. |
| **03** | **Zero non-essential trackers** | Block third-party advertising/analytics trackers before consent. | 0 third-party ad pixels (e.g. Meta, TikTok, Google Ads) without user consent banner. |
| **04** | **Symmetric cookie rejection** | "Reject All" button must be as easy to click and visible as "Accept All". | 1-click rejection without multi-level obscure toggles. Strictly necessary cookies only. |
| **05** | **Self-service data export** | Users must have the legal right to download a full copy of their data. | Instant JSON/CSV export endpoint (e.g. `/account/export-data`). |
| **06** | **Right to erasure (account deletion)** | Users can permanently delete their account and associated records. | Self-service deletion endpoint with confirmation dialog (e.g. `/account/delete`). |
| **07** | **Third-party processors disclosed** | List every external cloud infrastructure, database, and CDN processing data. | Explicitly name hosting, database (e.g. Firebase/Firestore), CDN, and QR APIs. |
| **08** | **HTTPS & Strong Encryption** | All traffic in transit and at rest must be cryptographically protected. | TLS 1.3 enforced, HSTS header active, passwords hashed with salted PBKDF2/Argon2. |
| **09** | **Minor & child protection advisory** | Clear guidelines on parental consent and age limits for minors. | Notice on age requirements for purchases and handling student data. |
| **10** | **72-hour breach response plan** | Legally required protocol to notify supervisory authorities and users. | Formal procedure documented in Privacy Policy for security incident notification. |

---

## Pillar 02: Money, Billing & Pricing (10 Items)

| # | Checklist Item | Requirement & Standard | Verification Criteria |
|---|---|---|---|
| **11** | **Upfront prices with currency & taxes** | Prices displayed before account creation or checkout start. | Currency declared (₹ / $) with "Inclusive of all applicable taxes" label. |
| **12** | **Recurring billing disclosures** | Any auto-renewing subscription must state cadence next to pay button. | If physical one-time items, explicitly declare "One-Time Payment - No Recurring Charges". |
| **13** | **Trial expiration warnings** | Notice must be sent before free trials convert into paid subscriptions. | Transparent timeline if trial services or memberships are offered. |
| **14** | **Zero hidden fees** | Every fee must be itemized before payment authorization. | Add-on options, custom sizes, and delivery fees itemized in cart/checkout before paying. |
| **15** | **Symmetric cancellation** | Cancelling must take as few steps as signing up. | Clear cancellation window before manufacturing starts (e.g. 2-hour window in Refund Policy). |
| **16** | **Published refund & remake policy** | Plain-language rules on returns, replacements, and damaged deliveries. | Published `/refund-policy` with 100% Free Remake guarantee for transit defects. |
| **17** | **Instant digital receipts** | Receipts sent immediately via email or WhatsApp after order completion. | Automated order confirmation and permanent order history view in customer account. |
| **18** | **Compliant payment standards** | Follow payment provider guidelines and standard payment protocols. | Validated NPCI UPI URI specifications (`upi://pay`) and gateway compliance. |
| **19** | **Tax compliance & registration** | Comply with applicable GST, VAT, or local sales tax regulations. | "Inclusive of all taxes" statement on product catalog, cart, checkout, and invoice. |
| **20** | **Authentic urgency & inventory** | Timers and stock notices must reflect genuine production schedules. | Countdown timers and batch deadlines must correspond to real laser-cutting production runs. |

---

## Pillar 03: Honesty, Transparency & Anti-Deception (7 Items)

| # | Checklist Item | Requirement & Standard | Verification Criteria |
|---|---|---|---|
| **21** | **Zero fake reviews or ratings** | Never fabricate testimonials, star ratings, or customer quotes. | 100% real verified feedback or omit review widgets until genuine feedback is collected. |
| **22** | **Substantiated performance claims** | Every claim about materials or speed must be technically verifiable. | Factual specs: 100% combed cotton, 4mm optical acrylic, 0.05mm CO2 laser precision. |
| **23** | **No unearned press or media badges** | Do not display "As seen on" logos without documented press coverage. | Only display factual affiliations or genuine campus student enterprise badges. |
| **24** | **Factual security badges only** | Do not display security seals you do not hold. | Replace generic vendor badges with truthful "HTTPS Encrypted" and "Direct UPI Validation". |
| **25** | **Genuine free offers** | "Free" means free with no hidden charges or forced payment details. | Campus delivery with coupon is genuinely ₹0 with no minimum card requirement. |
| **26** | **1:1 Price consistency** | Catalog price must match the final checkout charge. | Zero surprise surcharges, packaging fees, or gateway handling fees added at checkout. |
| **27** | **AI transparency** | Clearly label AI-generated imagery or automated features. | Explain whether product previews use physical laser mockups or generative artwork. |

---

## Pillar 04: Accessibility & Inclusivity (3 Items)

| # | Checklist Item | Requirement & Standard | Verification Criteria |
|---|---|---|---|
| **28** | **WCAG 2.2 AA Contrast Ratio** | Text must have sufficient contrast against its background (>= 4.5:1). | High-contrast text on dark canvas; form inputs with clear borders and focus states. |
| **29** | **Screen reader labels (ARIA & Alt)** | All interactive buttons, icons, and image previews must have labels. | `aria-label` on icon-only buttons, descriptive `alt` tags on all product images. |
| **30** | **Full keyboard operability** | Entire user flow usable with Tab, Enter, Space, and Esc keys. | Visible focus outlines, skip-to-content links, and keyboard-dismissible modals. |

---

## Pillar 05: Licences & Intellectual Property (4 Items)

| # | Checklist Item | Requirement & Standard | Verification Criteria |
|---|---|---|---|
| **31** | **Commercial asset licensing** | All fonts, illustrations, stock images, and icons verified for commercial use. | Fonts under Open Font License (OFL) or Apache 2.0; icons under MIT; custom photos. |
| **32** | **Open-source dependency audit** | Verify all npm dependencies use permissive licenses (MIT, Apache, BSD). | No copyleft viral licenses (e.g. GPL-3.0) that conflict with proprietary software. |
| **33** | **Trademark clearance** | Brand name, logo, slogans, and merchandise avoid trademark infringement. | Original logo, emblem, and brand name clearance. Customer IP indemnification clause. |
| **34** | **Truthful product photography** | Store photos depict genuine product materials and real finishes. | Real macro photography showing optical acrylic clarity, wood grain, and print textures. |

---

## Pillar 06: Terms of Service & Legal Governance (1 Item)

| # | Checklist Item | Requirement & Standard | Verification Criteria |
|---|---|---|---|
| **35** | **Published Terms of Service** | Comprehensive contract governing user conduct, IP, and liability limits. | Published at `/terms` and explicitly accepted by the user before placing an order. |
