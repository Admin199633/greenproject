# PROJECT_SUMMARY_UPDATE

Source of truth for recent changes, new files, and current implementation status.
Read this before starting any task.

---

## [2026-06-16] Document Numbering Start Numbers

FILES:
- `prisma/schema.prisma`
- `src/lib/validations/business.ts`
- `src/services/business.service.ts`
- `src/app/(dashboard)/settings/BusinessSettingsForm.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/services/document.service.ts`
- `src/services/document.service.test.ts`
- `PROJECT_SUMMARY_UPDATE.md`

DONE:
- Added separate Business start-number settings for all issued document types:
  `quoteStartNumber`, `receiptStartNumber`, `invoiceStartNumber`, and
  `invoiceReceiptStartNumber`, each defaulting to `1`.
- Kept existing prefix settings as prefix-only values:
  `quoteNumberPrefix`, `receiptNumberPrefix`, `invoiceNumberPrefix`, and
  `invoiceReceiptNumberPrefix`.
- Wired the new start-number fields through business settings validation,
  `updateBusiness()`, the settings page defaults, and the settings form payload.
- Reworked the settings form numbering section so each document type has a
  prefix input and a numeric start-number input.
- Updated `issueDraft()` numbering so a missing `DocumentCounter` is created
  with the relevant configured start number. Existing counters still use the
  same transactional increment path.
- Added issuance tests covering Quote, Receipt, Invoice, and Invoice Receipt:
  each starts from its configured start number and the second issued document
  increments correctly.

BEHAVIOR CHANGED:
- A business can now set `quoteNumberPrefix = "QUO-"` and
  `quoteStartNumber = 1165`; the first quote number is `QUO-1165`, then
  `QUO-1166`, `QUO-1167`, etc.
- The same prefix/start-number split applies to receipts, invoices, and invoice
  receipts.
- Businesses that do not configure start numbers keep the existing fallback:
  the first counter starts at `1`, so current default output remains
  `INV-0001`, `REC-0001`, `QUO-0001`, or `INVR-0001`.

NOT CHANGED:
- `DocumentCounter` remains the source of sequential numbering state.
- `issueDraft()` still performs counter upsert, document update, payment
  creation for receipt types, and duplicate-number conflict handling inside the
  existing DB transaction.
- The `(businessId, number)` unique constraint, duplicate conflict mapping,
  issueDraft validation guards, and draft immutability protections are
  preserved.

VERIFICATION:
- `npm test` — 6/6 suites, 66/66 tests pass.
- `npm run build` — passed. Prisma Client regenerated successfully. The build
  still prints pre-existing non-fatal `DYNAMIC_SERVER_USAGE` notices for
  report/export API routes that use `headers`.

NOTES:
- This working copy has no `prisma/migrations` directory, so the Prisma schema
  was updated directly. The target database still needs the equivalent
  migration / `prisma db push` before deploying this code.

---

## [2026-06-14] Public DB Health Endpoint

FILES:
- `src/app/api/health/db/route.ts`
- `PROJECT_SUMMARY_UPDATE.md`

DONE:
- Added public `GET /api/health/db`.
- The route does not call `requireSession()` / `requireBusiness()` and is not covered by the dashboard-only middleware matcher, so it does not require login.
- The route performs a minimal Prisma raw query: `SELECT 1`.
- On success it returns `200` JSON `{ ok: true }`.
- On failure it returns `500` JSON `{ ok: false }`.
- Error details, DB metadata, env vars, user/session data, and table data are never returned.
- Added `dynamic = "force-dynamic"` so external cron pings execute the DB check instead of using a cached route response.

NOT CHANGED:
- Prisma schema, migrations, RLS/database policy, auth services, middleware, and existing protected routes.

VERIFICATION:
- `npm run build` — first sandboxed run failed because Next could not fetch Google Fonts (`EACCES`). Reran with network approval; build passed and route table includes `/api/health/db`.
- `npm test` — 6/6 suites, 62/62 tests pass.
- Deployed URL check on 2026-06-14:
  - `https://liorsw.com/api/health/db` — `404 Not Found`.
  - `https://liorsw.com/green/api/health/db` — `404 Not Found`.
- The deployed checks indicate the new route is not deployed to production yet.

---

## [2026-05-10] Documents List - Payment Date Column

FILES:
- `src/app/(dashboard)/documents/page.tsx`
- `PROJECT_SUMMARY_UPDATE.md`

DONE:
- Added a new `מועד תשלום` column to the desktop documents list table between `תאריך` and `סה״כ`.
- The cell value renders from `document.eventDate` and uses the existing shared `formatDate()` helper.
- When `eventDate` is missing, the table shows `—`.
- Confirmed no query/API/schema change was needed because the existing `listDocuments()` query already returns `eventDate`.

VERIFICATION:
- `npm run build` - failed twice in this environment with `EPERM: operation not permitted, rename ... node_modules/.prisma/client/query_engine-windows.dll.node`. The failure happens during `prisma generate` before `next build`.
- `npm test` - passed (`6/6` suites, `62/62` tests).

---

## [2026-04-29] Configurable Approval WhatsApp Template In Business Settings

FILES:
- `prisma/schema.prisma`
- `src/lib/validations/business.ts`
- `src/services/business.service.ts`
- `src/app/(dashboard)/settings/BusinessSettingsForm.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/app/(dashboard)/documents/[id]/page.tsx`
- `src/components/documents/DocumentShareActions.tsx`
- `src/lib/documents/delivery.ts`
- `src/lib/documents/delivery.test.ts`

DONE:
- Added `Business.approvalWhatsappMessageTemplate String? @db.Text` so each business can store a customer-facing WhatsApp template for quote approval links.
- Wired the new field through the existing business settings PATCH flow.
- `/green/settings` now includes a textarea titled `הודעת וואטסאפ לשליחת הצעת מחיר` with the documented variables `{customerName}`, `{approvalUrl}`, `{eventDate}`, `{eventTime}`, `{eventLocation}`, `{businessName}`.
- `DocumentShareActions` now receives the business template plus quote/business context from the document detail page and builds the customer WhatsApp approval message from that template.
- Added centralized template rendering in `src/lib/documents/delivery.ts` with an emoji-rich default template fallback, token replacement, and safe fallbacks (`לקוח` for `customerName`, `—` for the other variables).
- `buildWhatsappShareUrl()` remains the only place that applies `encodeURIComponent`.

NOT CHANGED:
- Phone normalization in `normalizeWhatsappPhone()` is untouched.
- The post-approval owner WhatsApp redirect flow is untouched.
- The pre-`window.open` WhatsApp debug logging in `DocumentShareActions` remains in place.

VERIFICATION:
- `npx prisma generate` — clean.
- `npm run build` — succeeds.
- `npm test` — 6/6 suites, 62/62 tests pass.

NOTES:
- Database still needs `npx prisma db push` in the target environment so the new nullable `approvalWhatsappMessageTemplate` column exists before settings writes to it.

## [2026-04-29] Approval Share — WhatsApp Message Body Replaced

FILES:
- src/lib/documents/delivery.ts (`buildApprovalShareMessage`)

DONE:
- The approval-link WhatsApp message produced by `buildApprovalShareMessage` (the helper invoked by the **שלח קישור אישור** button on the document detail page) now uses the new copy verbatim:
  ```
  היי {customerName} 👋

  שלחתי לך הצעת מחיר מפוטופ 📸

  לצפייה בפרטי ההצעה ואישור התאריך:
  {approvalUrl}

  לאחר האישור התאריך יישמר עבורך ✅

  לכל שאלה אני כאן 🙂
  ```
- `customerName` now accepts `string | null | undefined`; when the trimmed value is empty the helper falls back to `"לקוח"`. `approvalUrl` stays a dynamic, required string and is interpolated as-is into the body.
- `DocumentShareActions` keeps calling `buildWhatsappShareUrl(phone, message)`, which still applies `encodeURIComponent` to the message and feeds the existing `normalizeWhatsappPhone` for the customer's phone. The button click flow (open-WhatsApp on phone available, copy-link + toast fallback otherwise) is unchanged.

NOT CHANGED:
- Phone normalization in `normalizeWhatsappPhone` (`+972 → 972`, `0XX → 972XX`, `972` passthrough, non-digits stripped) — untouched.
- Button label, ordering, styling, and behavior — untouched.
- The unrelated `buildApprovalWhatsappMessage` helper (used by tests / email) — untouched. The two helpers now produce the same body string but `buildApprovalShareMessage` is the sole one called from the document detail action.
- Public approval page and post-approval owner redirect flows — untouched.

VERIFICATION:
- `npm run build` — clean.
- `npm test` — 6/6 suites, 59/59 tests pass.

---

## [2026-04-29] Document Detail — Approval Action Becomes WhatsApp Send

FILES:
- src/lib/documents/delivery.ts (new `buildApprovalShareMessage` helper)
- src/components/documents/DocumentShareActions.tsx
- src/app/(dashboard)/documents/[id]/page.tsx (passes `customerName` + `customerPhone` again)

DONE:
- The primary action on the document detail page (first in the action order) is now **"שלח קישור אישור"** instead of "העתק קישור אישור". Clicking it:
  1. Resolves the approval URL via the existing `POST /api/documents/[id]/approval-link` route (cached in component state after the first call).
  2. Builds the message:
     ```
     הי {customerName}
     מצורפת הצעת המחיר לאישור:
     {approvalUrl}

     לאישור ההצעה יש ללחוץ על הקישור.
     ```
  3. Opens `https://wa.me/{normalizedPhone}?text=...` in a new tab via `window.open(url, "_blank", "noopener,noreferrer")`.
- **Phone normalization** uses the existing `normalizeWhatsappPhone` (in `delivery.ts`) which already implements the spec: strip non-digits, drop leading `+`, treat `00…` as international, and rewrite a leading `0` to `972` (so `0501234567` → `972501234567`). Numbers already starting with `972` are passed through unchanged. The URL itself is constructed by the existing `buildWhatsappShareUrl` helper.
- **Fallback when the customer has no phone**: copies the approval URL to the clipboard (using `navigator.clipboard.writeText`, with a `textarea` + `execCommand('copy')` fallback for older browsers) and shows the toast `"אין מספר טלפון ללקוח, הקישור הועתק"`. The copy-only behavior is no longer the primary path; it only runs as the explicit fallback.
- New helper **`buildApprovalShareMessage({ customerName, approvalUrl })`** added to `src/lib/documents/delivery.ts`. It returns the exact 4-line format above, with the `הי {name}` greeting falling back to a bare `היי` if the name is empty/whitespace.
- `DocumentShareActions` props updated to `{ documentId, customerName, customerPhone, publicPdfToken, approvalUrl?, canCopyApprovalLink? }`. The page passes `doc.customerName ?? getDisplayName(doc.customer)` and `doc.customer.phone`.

NOT CHANGED:
- The public approval flow under `src/app/approve/[token]/...` — still serves the same approval page, signature flow, and post-approval redirect. The button only links the customer to that page.
- The post-approval owner redirect (`buildOwnerApprovalRedirectWhatsappMessage`, `buildApprovedQuoteOwnerWhatsappMessage`) and the approval-time owner WhatsApp open inside `ApprovalForm` are untouched.
- `buildApprovalWhatsappMessage` (the old 👋/📸/✅/🙂 variant) is preserved alongside the new helper because the existing test in `delivery.test.ts` and `email.service.ts` still rely on its exact string. The document detail action does not call it anymore.
- The PDF download button styling/order (action #2 in the bar) is unchanged.

VERIFICATION:
- `npm run build` — clean.
- `npm test` — 6/6 suites, 59/59 tests pass.

---

## [2026-04-29] QUOTE Form Fields — dueDate Removed, Event Fields Required

FILES:
- src/lib/validations/document.ts (saveDraftSchema)
- src/components/documents/DocumentForm.tsx

DONE:
- **DocumentForm**:
  - When `type === "QUOTE"`, the **תאריך תשלום** (`dueDate`) input is no longer rendered. The payload likewise omits `dueDate` for QUOTE (`...(isQuote ? {} : { dueDate: dueDate || undefined })`). The companion `dueDate` state, `dueDateTouched`, and the `issueDate → dueDate` sync are kept but become inert for QUOTE.
  - Event fields (**תאריך האירוע**, **מיקום האירוע**, **שעת האירוע**) are now shown for **all** QUOTE drafts — the previous `businessType === "photography"` gate is dropped (replaced with `showQuoteEventFields = type === "QUOTE"`). Other document types still don't show these fields.
  - Each of the three event labels now carries the required indicator (`*`); the two HTML inputs have the `required` attribute. (`Time24Input` is a custom select-pair that doesn't accept `required` — its label still shows `*` and submission is gated by client-side and schema validation, so this matches the existing pattern used elsewhere in the form.)
  - `handleSave` runs Hebrew client-side validation before submitting a QUOTE: `"תאריך האירוע הוא שדה חובה"`, `"מיקום האירוע הוא שדה חובה"`, `"שעת האירוע היא שדה חובה"`. Errors surface in the existing `error` banner (matches the pattern used for receipt fields).
  - `businessType` prop is still accepted from `new` and `edit` pages but is no longer read inside the form — left in place to avoid touching unrelated callers.

- **saveDraftSchema** (`superRefine`):
  - Added a QUOTE branch (runs before the existing receipt branch). When `data.type === "QUOTE"`:
    - `eventDate` empty/whitespace → issue at `path: ["eventDate"]`, message `"תאריך האירוע הוא שדה חובה"`.
    - `eventLocation` trimmed length `< 1` → issue at `path: ["eventLocation"]`, message `"מיקום האירוע הוא שדה חובה"`.
    - `eventTime` empty/whitespace → issue at `path: ["eventTime"]`, message `"שעת האירוע היא שדה חובה"`.
  - The existing receipt-fields validation (`receiptAmountReceived`, `receiptPaymentMethod`) is unchanged — the early-return was rewritten so the QUOTE branch can run alongside it.

NOT CHANGED:
- DB schema (`Document.eventDate / eventLocation / eventTime` remain nullable).
- Other document types: INVOICE / RECEIPT / INVOICE_RECEIPT / CREDIT_NOTE keep their existing `dueDate` input and behavior, and never see the event-field requirement.
- `eventHours` remains optional and is not rendered as an input today; it continues to be sent through the payload spread when populated.
- API routes (`POST /api/documents`, `PATCH /api/documents/[id]`) — the schema change is picked up automatically; both routes already return `422` with `flatten().fieldErrors` on validation failure.
- Service layer (`createDraft` / `updateDraft`) handles undefined `dueDate` correctly today (`null` is persisted), so no service change was needed.

VERIFICATION:
- `npm run build` — clean.
- `npm test` — 6/6 suites, 59/59 tests pass.

---

## [2026-04-29] Document Detail — Action Buttons Cleanup

FILES:
- src/components/documents/DocumentShareActions.tsx (refactored)
- src/components/documents/SendDocumentButton.tsx (deleted — unused)
- src/app/(dashboard)/documents/[id]/page.tsx (props trimmed)

DONE:
- Removed the email send button (SendDocumentButton) and the WhatsApp share button from the document detail page action bar (mobile + desktop).
- Replaced the previous "העתקת קישור אישור" button (which opened WhatsApp) with a new primary action **"העתק קישור אישור"** that:
  - Calls the existing `POST /api/documents/[id]/approval-link` route to mint a fresh approval URL when one is not already cached on the client.
  - Copies the URL to the clipboard via `navigator.clipboard.writeText` (with a textarea+`execCommand('copy')` fallback for older browsers).
  - Shows a success toast: **"קישור הועתק"**.
- The new action uses the brand-primary style (`bg-brand-600`); other actions remain in the secondary/outline style.
- Final action order (when each action is applicable):
  1. העתק קישור אישור (primary, quote/issued/not-yet-approved only)
  2. הורדת PDF
  3. צור חשבונית
  4. צור קבלה
  5. צור חשבונית קבלה (when business is not osek_patur — kept alongside Receipt)
  6. שכפל מסמך
  7. צור זיכוי (when applicable — kept before Cancel)
  8. בטל מסמך (when cancelable)
- `DocumentShareActions` props slimmed to `{ documentId, publicPdfToken, approvalUrl?, canCopyApprovalLink? }` — customer name/email/phone, document type/number, and total are no longer passed because the email + WhatsApp share paths were removed from this component.

PRESERVED:
- `/api/documents/[id]/send` route is untouched (backend logic for email delivery remains in place).
- `/api/documents/[id]/approval-link` route, `mintQuoteApprovalToken`, and `buildApprovalUrl` are unchanged.
- The mobile action bar still uses `grid-cols-1` → `sm:grid-cols-2` → `lg:flex flex-wrap`, so buttons stack vertically on mobile, two-up on tablet, and wrap at desktop without overflow. All buttons keep `min-h-[44px] w-full` on mobile for touch targets.

VERIFICATION:
- `npm run build` — clean (only the pre-existing `DYNAMIC_SERVER_USAGE` notice on `/api/reports/revenue`, unrelated to this change).
- `npm test` — 6/6 suites, 59/59 tests pass.

---

## [2026-04-12] Legal Document Content — Tasks 3–8 Complete

### Task 3: Invoice Receipt (חשבונית מס/קבלה)
Verified — no changes needed. Payment section (Task 1) already renders for INVOICE_RECEIPT. VAT enforcement (Task 2) applies. PDF route blocks without payments.

### Task 4: Document Titles
Verified — all Hebrew titles correct in DOCUMENT_TYPE_LABELS. Heebo TTF font covers full Hebrew charset, no encoding issues.

### Task 5: Payment Method System
Verified — `PAYMENT_METHODS` const-enum, `z.enum` validation, `Payment.method String` NOT NULL in DB, `paymentMethodLabel()` in PDF. Complete.

### Task 6: PDF Content Enforcement
FILES: src/lib/pdf/document-pdf.tsx
- `issueDate` in PDF header changed from conditional to unconditional render (`formatDate` returns "—" if null, but always present on issued docs).
- All required fields (business name/taxId, number, date, customer name, totals) verified always present.

### Task 7: Validation Layer
Verified — all compliance rules enforce at service/API level:
- issueDraft: 5 backend checks (name, taxId, date, items, VAT rule)
- createPayment: enum method, amount, doc eligibility, balance, idempotency
- PDF route: receipt payment existence + method validity

### Task 8: Verification
Build: CLEAN. Tests: 43/43.

---

## [2026-04-12] Legal Document Content — Task 2: Invoice (חשבונית מס) Compliance

FILES: src/services/document.service.ts

DONE:
- **2.1 Required fields**: all verified present in PDF — title ("חשבונית מס"), number, issue date, business name/taxId/address (snapshots), customer name/taxId/address (snapshots), subtotal, VAT rate label, VAT amount (conditional), total.
- **2.2 VAT rules**: 
  - Exempt (`osek_patur`, `vatRateSnapshot=0`): VAT row already hidden by `{Number(document.vatRateSnapshot) > 0 && ...}` conditional in PDF template.
  - Authorized (`osek_murshe` / `chevra`): new backend enforcement in `issueDraft` — if `isAuthorizedBusiness && isInvoiceType && vatRateSnapshot <= 0` → pushed to `validationErrors` → 422 with message "עסק מורשה חייב לכלול מע״מ בחשבונית".

VERIFICATION: npx tsc --noEmit — clean. npm test — 43/43.

---

## [2026-04-12] Legal Document Content — Task 1: Receipt (קבלה) Compliance

FILES: src/lib/pdf/document-pdf.tsx, src/app/api/documents/[id]/pdf/route.ts, src/services/document.service.test.ts

DONE:
- **PdfDocumentData** type extended to include `payments: Payment[]`. Import added.
- **PAYMENT_METHOD_LABELS** imported in PDF template. `paymentMethodLabel()` helper converts stored method key (e.g. "cash") to Hebrew label (e.g. "מזומן").
- **"פרטי תשלום" section** added to PDF for RECEIPT and INVOICE_RECEIPT types when payments exist. Shows table: תאריך | אמצעי תשלום | אסמכתא | סכום. Final row shows "סה״כ התקבל" = `amountPaid`.
- **PDF route validation** (Task 1.3): for RECEIPT/INVOICE_RECEIPT, returns 400 if no payments exist or any payment has an invalid/missing method. Checked against `PAYMENT_METHODS` set.
- Required fields verified: title ("קבלה" via `DOCUMENT_TYPE_LABELS`), number (sequential), date (issueDate), business name/taxId, customer name, amount received (`amountPaid`), payment method — all present.
- Tests fixed: `issueDraft` mocks updated to include `mockItem` (full Decimal fields) and `mockDocTotals` required by `computeIssuedDocumentHash`.

VERIFICATION: npx tsc --noEmit — clean. npm test — 43/43.

---

## [2026-04-12] Bootstrap TASKS.md + PROJECT_SUMMARY_UPDATE.md

* Done: Created TASKS.md with phases 10–13 and backlog. Created this file.
* Why: Establishing task tracking workflow for session.
* Files: TASKS.md, PROJECT_SUMMARY_UPDATE.md
* New files: TASKS.md, PROJECT_SUMMARY_UPDATE.md
* Notes: Phase 10 (Business Settings) and Phase 12 (Auth) are fully done. Phase 11 missing only the duplicate API route. Phase 13 is QA/verification.

---

## [2026-04-12] Create duplicate document API route

* Done: POST `/api/documents/[id]/duplicate` — calls `duplicateDocument()`, returns `{ id }` with 201. Auth + 404 error handling matches project pattern.
* Why: DuplicateDocumentButton component already existed and called this endpoint.
* Files: `src/app/api/documents/[id]/duplicate/route.ts`
* New files: none (file existed as stub, updated to full implementation)
* Notes: Phase 11 now fully complete.

---

## [2026-04-12] npm run build — passed

* Done: Production build clean. 0 TS errors, 0 lint errors. 17 routes generated.
* Why: Verification step after Phase 11 completion.
* Files: none modified
* New files: none
* Notes: `/api/documents/[id]/duplicate` confirmed in route table.

---

## [2026-04-12] npm run test — 39/39 passed

* Done: All 3 test suites passed, 39 tests, 0 failures.
* Why: Verification step — confirm existing tests unbroken after Phase 11.
* Files: none modified
* New files: none
* Notes: none

---

## [2026-04-12] Auth alignment — partial area #1 complete

AREA: Auth

CURRENT: Custom login/signout routes existed. Cookie options correct (httpOnly, sameSite: lax, secure in prod, maxAge 30 days). `requireSession()` and `requireBusiness()` in auth.service.ts used by all API routes and most pages. `getServerSession(authOptions)` still used in layout.tsx and was being called directly in dashboard/page.tsx.

GAP: `GET /api/auth/me` missing. `dashboard/page.tsx` called `getServerSession` directly instead of `requireSession()`. `[...nextauth]` directory was empty (stale residual).

ACTION:
- Created `GET /api/auth/me` — returns `{ id, email, name, businessId }` from session, 401 if unauthenticated
- Fixed `dashboard/page.tsx` to use `requireSession()` instead of direct `getServerSession` call
- Confirmed `[...nextauth]` directory was already empty; no stale route needed removal
- Build passed: 18 routes, 0 errors

FILES: `src/app/api/auth/me/route.ts` (new), `src/app/(dashboard)/dashboard/page.tsx`

VERIFICATION: `npm run build` — clean, `/api/auth/me` confirmed in route table

SUMMARY UPDATE: Auth partial area complete. GET /api/auth/me added. dashboard/page.tsx aligned to requireSession(). [..nextauth] directory confirmed empty.

---

## [2026-04-12] Business Settings — fields aligned

AREA: Business Settings

CURRENT: name, taxId, address, phone, email fields existed in schema, validation, service, and form.

GAP: city, postalCode, country, taxType, vatRate, currency, invoiceNumberPrefix, receiptNumberPrefix, quoteNumberPrefix, invoiceReceiptNumberPrefix all missing.

ACTION:
- Added all missing fields to prisma/schema.prisma with appropriate defaults
- Ran prisma generate (types updated)
- Updated businessSchema (lib/validations/business.ts) with all new fields + validation
- Updated updateBusiness service to write all new fields with fallback defaults
- Updated settings/page.tsx to pass all new defaultValues
- Rebuilt BusinessSettingsForm with grouped sections: identity, contact, address, billing, prefixes
- PATCH updates explicit whitelist only — no extra fields possible

FILES: prisma/schema.prisma, src/lib/validations/business.ts, src/services/business.service.ts, src/app/(dashboard)/settings/page.tsx, src/app/(dashboard)/settings/BusinessSettingsForm.tsx

VERIFICATION: npm run build — clean, 18 routes, 0 TS errors

SUMMARY UPDATE: Business Settings fields aligned. All architecture-spec fields added. Build clean. Migration pending DB start (docker compose up -d then prisma migrate dev).

---

## [2026-04-12] Duplicate Document — verified complete

AREA: Duplicate Document

CURRENT: duplicateDocument() service, POST /api/documents/[id]/duplicate route, DuplicateDocumentButton component, integrated on document detail page.

GAP: None found.

ACTION: Code audit only. Verified all requirements by reading service, route, and button.

FILES: none changed

VERIFICATION: Code review — status=DRAFT, number=null, items copied via createMany, amountPaid=0, businessId filter enforces cross-business protection, router.push to /documents/{id}/edit, isPending + error UI state present.

SUMMARY UPDATE: Duplicate Document verified complete. No gaps. No changes needed.

---

## [2026-04-12] PDF — verified and logo support added

AREA: PDF

CURRENT: PDF generation, RTL, Hebrew font, snapshot-first, status restrictions (draft/cancelled blocked), download filename all existed.

GAP: BuildPdfInput.business only picked name/taxId/address — logo, phone, email not accessible in template. Logo never rendered.

ACTION:
- Added Image import from @react-pdf/renderer
- Expanded BuildPdfInput.business Pick to include logo, phone, email
- Renders logo image when business.logo is set
- Renders business phone and email in PDF header when set
- All other checks passed: draft blocked, cancelled blocked, snapshot-first fallback correct, text wrap natural, page breaks via wrap={false} on rows

FILES: src/lib/pdf/document-pdf.tsx

VERIFICATION: npm run build — clean, 0 TS errors

SUMMARY UPDATE: PDF verified and hardened. Logo support added. Business phone/email in header. Build clean.

---

## [2026-04-12] Dashboard — verified complete

AREA: Dashboard

CURRENT: getDashboardData service, KPI cards, recent documents, recent payments, overdue documents on dashboard page.

GAP: None found.

ACTION: Code audit only.

FILES: none changed

VERIFICATION: All queries scoped to businessId. DRAFT/CANCELLED excluded from KPIs. CREDIT_NOTE excluded from open/overdue. Overdue condition correct (ISSUED/PARTIALLY_PAID + dueDate < today + amountDue > 0). Server component calls service directly — no REST route needed.

SUMMARY UPDATE: Dashboard verified correct. No gaps. No changes needed.

---

## [2026-04-12] Core Customers / Documents / Payments — verified and patched

AREA: Core Customers / Documents / Payments

CURRENT: Full CRUD for customers/documents/payments, filters, search, snapshot logic, status guards, sequential numbering all existed.

GAP: formatDocumentNumber used hardcoded prefixes (INVOICE:"INV", RECEIPT:"REC", etc.) — did not use the business-configured invoiceNumberPrefix / receiptNumberPrefix / quoteNumberPrefix / invoiceReceiptNumberPrefix fields added in Business Settings.

ACTION:
- Replaced NUMBER_PREFIX constant with DEFAULT_NUMBER_PREFIX (matching business settings defaults)
- Added getDocumentPrefix() helper that reads from business object, falls back to defaults
- Updated issueDraft to pass getDocumentPrefix(doc.type, business) to formatDocumentNumber
- All 39 tests pass (mock business without prefix fields correctly falls back to "INV-" etc.)
- Build clean

FILES: src/services/document.service.ts

VERIFICATION: npm test — 39/39. npm run build — clean.

SUMMARY UPDATE: Document numbering now uses business-configured prefixes. Tests green. Build clean.

---

## [2026-04-12] Schema Alignment — verified and indexes added

AREA: Schema Alignment

CURRENT: Full schema for User, Business, Customer, Document, DocumentItem, Payment, DocumentCounter. All money fields Decimal. Unique constraints in place.

GAP: No explicit indexes on FK columns — Customer.businessId, Document.businessId/customerId, Payment.businessId/documentId/customerId. PostgreSQL does not auto-index FK columns.

ACTION:
- Added @@index([businessId]) on Customer, Document, Payment
- Added @@index([businessId, status]) on Document (most common filter pattern)
- Added @@index([customerId]) on Document, Payment
- Added @@index([documentId]) on Payment
- Migration applied: 20260411220350_add_indexes

FILES: prisma/schema.prisma, prisma/migrations/20260411220350_add_indexes/

VERIFICATION: npm test — 39/39. npm run build — clean.

SUMMARY UPDATE: Schema fully aligned. Indexes added on all critical FK columns. Migration applied.

---

## [2026-04-12] Build / Tests — final QA

AREA: Build / Tests

CURRENT: Build clean, 39 tests passing.

GAP: duplicateDocument had zero test coverage.

ACTION:
- Added 4 tests for duplicateDocument: DRAFT+no-number, items copied, cross-business protection, snapshot fields cleared
- All 43 tests pass

FILES: src/services/document.service.test.ts

VERIFICATION: npm test — 43/43 passed.

SUMMARY UPDATE: All 8 partial areas complete. 43 tests passing. Build clean. All migrations applied.

---

## [2026-04-12] Reports 1.1 — Revenue Report API

TASK: GET /api/reports/revenue

PLAN: Fetch INVOICE+INVOICE_RECEIPT docs excluding DRAFT/CANCELLED, aggregate by YYYY-MM in JS.

FILES: src/app/api/reports/revenue/route.ts (new)

DONE: GET /api/reports/revenue with dateFrom/dateTo filters. Groups by month, returns rows of {month, count, subtotalAmount, taxAmount, totalAmount}. Auth via requireBusiness(). Decimal arithmetic with Prisma.Decimal.

VERIFICATION: npm run build — clean, route listed as ƒ /api/reports/revenue.

SUMMARY UPDATE: Revenue report API done.

---

## [2026-04-12] Reports Module — APIs + UI complete (tasks 1–8)

TASK: Reports Full Module

PLAN: 4 API routes + server-component reports page with URL-driven tabs.

FILES:
- src/app/api/reports/revenue/route.ts (new)
- src/app/api/reports/open-documents/route.ts (new)
- src/app/api/reports/payments/route.ts (new)
- src/app/api/reports/customers/route.ts (new)
- src/app/(dashboard)/reports/page.tsx (new)
- src/components/layout/Sidebar.tsx (דוחות link added)

DONE:
- GET /api/reports/revenue — groups INVOICE+INVOICE_RECEIPT by month, dateFrom/dateTo filters, returns month/count/subtotal/tax/total
- GET /api/reports/open-documents — ISSUED+PARTIALLY_PAID, ordered by dueDate
- GET /api/reports/payments — date/method/customer filters
- GET /api/reports/customers — per-customer aggregation (count, billed, paid, balance)
- /reports page: 3 tabs (revenue/open/payments), URL-driven, server-side data fetch, date+method filters, overdue row highlighting, totals row on revenue tab, empty states

VERIFICATION: npm run build — clean, /reports + 4 API routes in route table. npm test — 43/43.

SUMMARY UPDATE: Reports module complete. 4 APIs + UI page with 3 tabs.

---

## [2026-04-12] Customer Details — REST API added

TASK: GET /api/customers/:id

PLAN: Route calls existing getCustomerDetail service, returns customer + documents + payments + openAmount. UI sections already existed.

FILES: src/app/api/customers/[id]/route.ts (new)

DONE: GET /api/customers/:id — auth via requireBusiness(), 404 if not found or wrong business, returns { customer, documents, payments, openAmount }.

VERIFICATION: npm run build — clean, /api/customers/[id] in route table.

SUMMARY UPDATE: Customer REST API added. UI was already complete.

---

## [2026-04-12] Payments Filters UI

TASK: Payments Filters UI — method, date range, customer

FILES: src/services/payment.service.ts, src/app/(dashboard)/payments/page.tsx

DONE: Added ListPaymentsFilters interface to listPayments service (method, dateFrom, dateTo, customerId). Payments page now accepts searchParams, renders filter bar (date range, method select, customer select), passes filters to service, shows context-aware empty state, clear-filters link.

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: Payments filters UI complete. Method, date range, customer filter all wired.

---

## [2026-04-12] CSV Export — documents list

TASK: GET /api/documents/export + export button on documents page

FILES:
- src/app/api/documents/export/route.ts (new)
- src/app/(dashboard)/documents/page.tsx (export button added)

DONE: GET /api/documents/export accepts same filter params as listDocuments (q, type, customerId, status, dateFrom, dateTo). Returns CSV with Hebrew headers: מספר, לקוח, סוג, סטטוס, תאריך, סה״כ. escapeCell() handles commas/quotes/newlines. Content-Type: text/csv; Content-Disposition: attachment. Documents page header now has "ייצוא CSV" link button that passes current filter params to the export endpoint.

VERIFICATION: npm run build — clean, /api/documents/export in route table. npm test — 43/43.

SUMMARY UPDATE: CSV export complete. API route + UI button wired with active filters.

---

## [2026-04-12] README & Setup

TASK: README & Setup documentation

FILES: README.md (new)

DONE: README covers prerequisites, setup steps (install/env/docker/migrate/seed), env variable table, dev/build/test commands, migration commands, feature overview. Seed credentials documented (admin@example.com / password123).

VERIFICATION: File created. No build changes needed.

SUMMARY UPDATE: README complete with full setup, env, migration, seed, and run instructions.

---

## [2026-04-12] Production Cleanup

TASK: Remove dead code, debug logs, unused imports; verify no errors

FILES: none changed

DONE: Audited all console.* calls — all are console.error in catch blocks (legitimate, kept). Zero TODO/FIXME/HACK/debugger in codebase. npx tsc --noEmit — 0 errors. npm run build — 0 TS/lint errors. No dead files found. No unused imports detected by compiler.

VERIFICATION: npx tsc --noEmit clean. npm run build clean.

SUMMARY UPDATE: Production cleanup complete. No dead code, no debug logs, no TS errors.

---

## [2026-04-12] CSV Export — verified complete (Task 1.1)

TASK: Documents CSV Export

ACTION: Verification only — already implemented this session.

FILES: src/app/api/documents/export/route.ts, src/app/(dashboard)/documents/page.tsx

VERIFIED: All 6 required fields present (number, type, customer name, totalAmount, status, issueDate). Empty dataset returns header-only CSV. Content-Disposition: attachment triggers download. Export button on documents page passes active filter params.

SUMMARY UPDATE: Task 1 (CSV Export) confirmed complete. No changes needed.

---

## [2026-04-12] Email Sending — Task 2 complete

TASK: Email Sending (2.1 service + 2.2 API route + 2.3 UI)

FILES:
- src/services/email.service.ts (new)
- src/app/api/documents/[id]/send/route.ts (new)
- src/components/documents/SendDocumentButton.tsx (new)
- src/app/(dashboard)/documents/[id]/page.tsx (SendDocumentButton added)
- .env.example (SMTP vars added)

DONE:
- sendDocumentEmail(documentId, businessId): validates status (must be issued), resolves customer email (snapshot customerEmail ?? customer.email), generates PDF via renderDocumentPdf, sends via nodemailer. If SMTP_HOST is not set, stubs the send (logs to console.error) and returns { sent: false }
- POST /api/documents/:id/send: calls sendDocumentEmail, maps all error messages to Hebrew 400/404 responses
- SendDocumentButton: client component with loading/success/error states; disabled when customer has no email
- Button rendered in document detail page alongside "הורד PDF" when canDownloadPdf is true
- SMTP config: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM in .env.example

VERIFICATION: npm run build — clean, /api/documents/[id]/send in route table. npm test — 43/43.

SUMMARY UPDATE: Email sending complete. Stub mode works without SMTP config. Full send when SMTP_HOST is set.

---

## [2026-04-12] UX Improvements — Task 3 complete

TASK: UX Improvements (3.1 loading, 3.2 error handling, 3.3 empty states)

FILES: src/app/(dashboard)/loading.tsx (new)

DONE:
- 3.1 Loading: Added loading.tsx at (dashboard) group level — single file covers all dashboard routes via Next.js App Router convention. Pulse skeleton with title + content placeholders.
- 3.2 Error handling: Audited all client components (IssueDraftButton, CancelDocumentButton, CancelDocumentButton, DuplicateDocumentButton, AddPaymentForm, CustomerForm, DocumentForm, SendDocumentButton). All already have loading states, inline Hebrew error messages, res.ok checks. Already standardized — no changes needed.
- 3.3 Empty states: All pages already have empty states — customers (context-aware search), documents, payments (filter-aware), reports (per-tab). No changes needed.

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: Task 3 complete. Loading skeleton added. Error handling and empty states already complete.

---

## [2026-04-12] Document Page Improvements — Task 4 complete

TASK: Document page actions grouping and status display (4.1 + 4.2)

FILES: src/app/(dashboard)/documents/[id]/page.tsx

DONE:
- 4.1 Actions: Restructured document detail page header into a single grouped flex actions bar. Draft state: Issue → Edit → Duplicate → Delete (ordered by primary action first). Issued state: PDF download → Send Email → Duplicate → Credit Note → Cancel (ordered by common-to-rare usage). All buttons already had disabled states during async operations.
- 4.2 Status display: Audited DocumentStatusBadge — already has distinct color per status (slate/blue/amber/green/red). DOCUMENT_STATUS_LABELS already in Hebrew. Consistent across documents list, detail page, and reports. No changes needed.

VERIFICATION: npm run build — clean, 0 TS errors.

SUMMARY UPDATE: Task 4 complete. Actions grouped into single bar. Status badges already well-implemented.

---

## [2026-04-12] PDF Enhancements — Task 5 complete

TASK: PDF branding (5.1) and layout fixes (5.2)

FILES: src/lib/pdf/document-pdf.tsx

DONE:
- Branding: Added top accent bar (4px, brand blue #1e40af) via fixed View. Logo moved to dedicated logoWrapper with alignItems flex-end, size increased to 100×48. Business name now uses larger businessName style (14pt bold) separate from title. Document title uses BRAND_COLOR.
- Header: Left block = document type/number/status/date. Right block = logo + business details. Clear visual hierarchy.
- Section titles: now colored with BRAND_COLOR + bottom border for visual separation.
- Table header: dark blue background (#1e40af) with white text instead of light grey — much stronger visual contrast.
- Alternating row background (tableRowAlt, #f8fafc on odd rows) for readability on long documents.
- Totals block: border-wrapped, final row highlighted with light blue background.
- Footer: fixed footer on all pages with business name (right) + page X/Y (left), separated by top border.
- Spacing: paddingVertical on cells increased 7→8, section margin 16→18, page padding adjusted for footer.

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: PDF enhanced with brand color, improved logo placement, alternating rows, colored table header, page numbers.

---

## [2026-04-12] Toast Notifications — Task 6 complete

TASK: Basic toast notification system

FILES:
- src/components/ui/Toast.tsx (new)
- src/components/Providers.tsx (ToastProvider added)
- src/components/documents/IssueDraftButton.tsx (toast wired)
- src/components/documents/CancelDocumentButton.tsx (toast wired)
- src/components/documents/SendDocumentButton.tsx (simplified to use toast only)
- src/components/payments/AddPaymentForm.tsx (toast wired)

DONE: ToastProvider context + useToast hook + fixed bottom-right Toaster. Auto-dismiss after 4s, manual dismiss button. Success (green) and error (red) variants. Wired in: issue document (success/error), cancel document (success/error), add payment (success/error), send email (success/error). SendDocumentButton simplified — removed inline success/error messages since toast covers feedback. ToastProvider added to root Providers component (covers all pages).

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: Toast system complete. All key actions now show feedback toasts.

---

## [2026-04-12] Business tax behavior for exempt quotes — Task 1 complete

AREA: Business Customization + Quote Improvements — Task 1

FILES: src/app/(dashboard)/documents/new/page.tsx

DONE: NewDocumentPage now computes defaultVatRate from business: "0" when taxType === "osek_patur", otherwise String(Number(business.vatRate)). Passed as defaultValues.vatRateSnapshot to DocumentForm. DocumentForm already initializes vatRateSnapshot from defaultValues, so exempt businesses get 0% pre-filled. Calculations (calcItem with vatRate=0) correctly produce taxAmount=0, subtotal=total. PDF renders 0 VAT naturally from stored vatRateSnapshot. Edit page unaffected (uses document's own stored vatRateSnapshot).

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: Exempt quote VAT defaults to 0 for osek_patur businesses. No schema changes required.

---

## [2026-04-12] businessType field — Task 2 complete

AREA: Business Customization — Task 2

FILES:
- prisma/schema.prisma (businessType String @default("general") added to Business)
- prisma/migrations/…add_business_type (migration applied)
- src/lib/validations/business.ts (businessType enum added)
- src/services/business.service.ts (businessType written in updateBusiness)
- src/app/(dashboard)/settings/page.tsx (businessType passed as defaultValue)
- src/app/(dashboard)/settings/BusinessSettingsForm.tsx (select added, payload + Props updated)

DONE: businessType field with values: general/photography/contractor/consulting/retail/other. Hebrew labels. Rendered as select in settings form alongside taxType. Saved via PATCH /api/business. Loaded on settings page from DB. Migration applied (add_business_type).

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: businessType field fully wired: schema, migration, validation, service, settings page, form.

---

## [2026-04-12] Quote default dates — Task 3 complete

AREA: Business Customization — Task 3

FILES: src/components/documents/DocumentForm.tsx

DONE: issueDate now defaults to today (new Date().toISOString().slice(0,10)) when no defaultValues.issueDate is provided. dueDate defaults to same as issueDate. dueDateTouched flag tracks whether user has manually edited dueDate — while untouched, changing issueDate also updates dueDate. Once user edits dueDate, sync stops. Edit mode: dueDateTouched initialized to true when defaultValues has a dueDate different from issueDate, preserving edit-page behavior.

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: New document form now defaults both dates to today, with dueDate synced to issueDate until manually changed.

---

## [2026-04-12] Saved/preset items — Task 4 complete

AREA: Business Customization — Task 4

FILES:
- prisma/schema.prisma (SavedItem model added, Business.savedItems relation)
- prisma/migrations/…add_saved_items (applied)
- src/lib/validations/savedItem.ts (new)
- src/services/savedItem.service.ts (new — list/create/update/delete)
- src/app/api/saved-items/route.ts (new — GET/POST)
- src/app/api/saved-items/[id]/route.ts (new — PATCH/DELETE)
- src/app/(dashboard)/settings/SavedItemsManager.tsx (new — client component)
- src/app/(dashboard)/settings/page.tsx (savedItems section added)
- src/components/documents/DocumentForm.tsx (savedItems prop + preset picker dropdown)
- src/app/(dashboard)/documents/new/page.tsx (savedItems fetched + passed)
- src/app/(dashboard)/documents/[id]/edit/page.tsx (savedItems fetched + passed)

DONE: SavedItem model: id, businessId, name, description, defaultPrice (Decimal), unit, timestamps, @@index([businessId]). Full CRUD API. Settings page shows saved items list + add form. DocumentForm: when savedItems is non-empty, shows "הוסף מפריט שמור" select above the items table; selecting a preset appends a new item row pre-filled with description and unitPrice. savedItems prop is optional (no-op if empty).

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: Saved items fully implemented: schema, migration, API, settings manager UI, document form picker.

---

## [2026-04-12] Photography quote fields — Task 5 complete

AREA: Business Customization — Task 5

FILES:
- prisma/schema.prisma (eventDate DateTime?, eventLocation String?, eventHours Decimal? added to Document)
- prisma/migrations/…add_photography_fields (applied)
- src/lib/validations/document.ts (eventDate/eventLocation/eventHours added to saveDraftSchema)
- src/services/document.service.ts (createDraft + updateDraft write photography fields)
- src/components/documents/DocumentForm.tsx (businessType prop, showPhotographyFields flag, fields section, state, payload)
- src/app/(dashboard)/documents/new/page.tsx (businessType prop passed)
- src/app/(dashboard)/documents/[id]/edit/page.tsx (fullBusiness fetched, businessType + eventDate/Location/Hours defaults passed)
- src/app/(dashboard)/documents/[id]/page.tsx (photography fields shown in detail grid when present)
- src/lib/pdf/document-pdf.tsx (פרטי האירוע section in PDF when fields are set)

DONE: Fields visible only when businessType === "photography" AND type === "QUOTE". Completely invisible for other business types or other document types. Fields saved/loaded in create and edit modes. Detail page shows them when present. PDF includes פרטי האירוע section with all three fields.

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: Photography quote fields fully wired: schema, migration, form (conditional), detail page, PDF.

---

## [2026-04-12] Fix 1 — Saved item description textarea

FILES: src/app/(dashboard)/settings/SavedItemsManager.tsx

DONE: Description field changed from Input to textarea (rows=3, resize-none). Moved below the 2-col grid so it spans full width. Item list preview changed from truncate to whitespace-pre-wrap line-clamp-2. Description value passed to document form item rows unchanged — multiline text preserves naturally.

VERIFICATION: npm run build — clean.

SUMMARY UPDATE: Saved item description is now a multiline textarea. Line breaks preserved end-to-end.

---

## [2026-04-12] Fix 2 — Exempt quote VAT row hidden

FILES: src/components/documents/DocumentForm.tsx, src/app/(dashboard)/documents/new/page.tsx, src/app/(dashboard)/documents/[id]/edit/page.tsx, src/lib/pdf/document-pdf.tsx

DONE: Added isExempt prop to DocumentForm (default false). When true, the VAT row in the totals section is hidden. new/page.tsx passes isExempt={business.taxType === "osek_patur"}. edit/page.tsx passes isExempt={fullBusiness?.taxType === "osek_patur"}. PDF: wrapped VAT row with {Number(document.vatRateSnapshot) > 0 && (...)} — hides row for exempt businesses where vatRateSnapshot=0.

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: Exempt businesses no longer show VAT row in quote form totals or PDF.

---

## [2026-04-12] Fix 3 — Photography eventTime field added

FILES: prisma/schema.prisma, prisma/migrations/20260412000000_add_event_time/migration.sql, src/lib/validations/document.ts, src/services/document.service.ts, src/components/documents/DocumentForm.tsx, src/app/(dashboard)/documents/[id]/edit/page.tsx, src/app/(dashboard)/documents/[id]/page.tsx, src/lib/pdf/document-pdf.tsx

DONE: Added eventTime String? to Document schema. Migration created (ALTER TABLE ADD COLUMN "eventTime" TEXT). Validation: eventTime z.string().max(10).optional(). Service: writes eventTime?.trim() || null in both createDraft and updateDraft. DocumentForm: added eventTime state, time input field ("שעת האירוע", type=time) alongside existing eventDate/eventLocation. eventTime sent in payload when showPhotographyFields=true. Edit defaults: eventTime loaded from doc.eventTime. Detail page: shows "שעת האירוע" when eventTime is present. PDF: shows "שעת האירוע" field in פרטי האירוע section when eventTime is set.

VERIFICATION: npm run build — clean. npm test — 43/43.

SUMMARY UPDATE: Photography quotes now show eventDate, eventLocation, and eventTime (time of day). All three fields save, load, and render in detail page and PDF.

---

## [2026-04-12] Issue Notification — Task 1: Business setting

FILES: prisma/schema.prisma, prisma/migrations/20260412000001_add_send_issue_notification_email/migration.sql, src/lib/validations/business.ts, src/services/business.service.ts, src/app/(dashboard)/settings/BusinessSettingsForm.tsx, src/app/(dashboard)/settings/page.tsx

DONE: Added `sendIssueNotificationEmail Boolean @default(false)` to Business schema. Migration created. Validation: `z.boolean().optional().default(false)`. Service writes the field in `updateBusiness`. Settings form: checkbox "שלח אימייל לעסק בעת הנפקת מסמך" in new "התראות" section, reads via `.checked`. Settings page passes `business.sendIssueNotificationEmail ?? false` to form.

VERIFICATION: npm run build — clean.

SUMMARY UPDATE: sendIssueNotificationEmail setting fully wired: schema, migration, validation, service, settings form, settings page.

---

## [2026-04-12] Issue Notification — Task 2: Notification email service

FILES: src/services/email.service.ts

DONE: Added `sendIssueNotificationEmail(documentId, businessId)` to email.service.ts. Loads document + business in parallel. Returns `{ sent: false }` (no throw) when business.email is missing. Builds plain-text body: typeLabel + docRef + customerName + totalAmount + issueDate + link. Uses shared `createTransport()`. Stub mode (no SMTP_HOST): logs to console.error and returns `{ sent: false }`. Subject: "[הנפקה] {typeLabel} {docRef}". No PDF attachment in this phase.

VERIFICATION: npm run build — clean.

SUMMARY UPDATE: sendIssueNotificationEmail service done. Never throws — issue flow will not be blocked.

---

## [2026-04-12] Issue Notification — Task 3: Issue flow integration

FILES: src/app/api/documents/[id]/issue/route.ts

DONE: After successful `issueDraft()`, fetches business and checks `sendIssueNotificationEmail`. If true, calls `sendIssueNotificationEmail(doc.id, session.id)` — fire-and-forget via `.catch()`. Errors are logged via `console.error` and do NOT propagate. Issue response is returned immediately after `issueDraft` succeeds, regardless of email outcome.

VERIFICATION: npm run build — clean.

SUMMARY UPDATE: Notification email integrated into issue flow. Non-blocking. Issue always succeeds.

---

## [2026-04-12] Issue Notification — Task 4: PDF attachment decision

Decision: skip PDF attachment in this phase. Plain-text notification email is sufficient for phase 1. The `sendDocumentEmail` service already handles PDF-attached emails sent to customers; the notification to the business is intentionally lightweight.

---

## [2026-04-12] Issue Notification — Task 5: Verification

VERIFICATION:
- Email disabled (sendIssueNotificationEmail=false): if-guard prevents the call entirely. Issue always returns 200.
- business.email missing: service returns { sent: false } early before transport is needed.
- SMTP missing (no SMTP_HOST): createTransport() returns null → stub logs to console.error → returns { sent: false }. Never throws.
- Email triggered when enabled: route calls sendIssueNotificationEmail fire-and-forget (.catch) when setting is true.
- Issue never blocked: sendIssueNotificationEmail never throws; .catch() wraps the call; response is returned immediately after issueDraft().
- npm run build — clean (✓).
- npm test — 43/43 (✓).

SUMMARY UPDATE: Automatic Issue Notification Email phase complete. All 5 tasks done. Build clean, tests green.

---

## [2026-04-12] Compliance Phase — Tasks 8–10 Complete

### Task 8: Backup Readiness
FILES: scripts/db-backup.sh (new), README.md (backup section added)
DONE: `scripts/db-backup.sh` — sources `.env`, pg_dump with gzip, timestamped to `./backups/`, retains last 30 dumps, cron example. README: backup section with env vars table, cron example, restore command, note to backup `.env` separately.

### Task 9: PDF Compliance
FILES: none changed
VERIFIED: All 6 required fields present: businessName (snapshot+fallback), businessTaxId (snapshot+fallback), document.number (always set at issue), issueDate (formatDate shown in header and details), customerName (snapshot+fallback), totals (subtotal/vat/total/paid/due all rendered). PDF route only allows ISSUED/PARTIALLY_PAID/PAID — at those statuses all snapshot fields are guaranteed populated by issueDraft. No changes needed.

### Task 10: Verification
- Build: CLEAN (no TS/lint errors, all 24 routes listed)
- Tests: 43/43 PASSED

---

## [2026-04-12] Compliance Task 7 — Soft Delete Policy

FILES: prisma/schema.prisma, prisma/migrations/20260412000004_soft_delete_document/migration.sql, src/services/document.service.ts, src/services/document.service.test.ts

DONE:
- Added `DELETED` to `DocumentStatus` enum. Migration: `ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'DELETED'`.
- `deleteDraft`: changed from `db.document.delete()` to `db.document.update({ data: { status: "DELETED" } })`. Row is preserved in DB.
- `listDocuments`: if no status filter, applies `status: { not: DocumentStatus.DELETED }`. If a specific status is requested, uses that value as-is (UI doesn't request DELETED, so deleted items never appear).
- `getDocumentById`: adds `status: { not: DocumentStatus.DELETED }` — GET /api/documents/:id returns 404 for soft-deleted docs.
- Test updated: `deleteDraft` test now asserts `document.update` with `status: "DELETED"` and confirms `document.delete` is NOT called.

VERIFICATION: npx tsc --noEmit — clean. npm test — 43/43.

---

## [2026-04-12] Compliance Task 6 — Data Integrity Guards

FILES: none changed — all guards already present in src/services/payment.service.ts

VERIFIED:
- payment > amountDue: checked pre-transaction (line 108) + re-checked inside transaction (line 120).
- payment on cancelled document: checked pre-transaction (line 103) + inside transaction (line 118).
- payment on QUOTE/CREDIT_NOTE: checked pre-transaction (lines 101-102).
- double payment idempotency: dedup check within 60s window on (documentId, amount, method, reference, paymentDate), throws "Duplicate payment detected" (lines 124-135).
All guards are transactionally safe (status re-checked inside `db.$transaction`).

---

## [2026-04-12] Compliance Task 5 — Business Identity Validation

FILES: src/lib/validations/business.ts, src/app/(dashboard)/settings/BusinessSettingsForm.tsx

DONE:
- `taxId` in businessSchema changed from optional string to `z.string().min(1, "מספר עוסק / ח.פ חובה")`. PATCH /api/business now returns 422 if taxId is empty/missing.
- `name` already required (min(1)). No change needed.
- Issue blocking (Task 4 already covers this): `issueDraft` throws `VALIDATION:מספר עוסק / ח.פ חסר` when business.taxId is blank.
- UI: taxId label now shows asterisk "מספר עוסק / ח.פ. *".

VERIFICATION: npx tsc --noEmit — clean. npm test — 43/43.

---

## [2026-04-12] Compliance Task 4 — Required Fields Enforcement

FILES: src/services/document.service.ts, src/app/api/documents/[id]/issue/route.ts, src/services/document.service.test.ts

DONE:
- `issueDraft` now loads items in the pre-transaction `findFirst` (via `include: { items: { select: { id: true } } }`).
- Validates BEFORE entering the transaction: business.name present, business.taxId present, doc.issueDate present, doc.items.length > 0.
- Errors accumulate in a `validationErrors` array; if any fail, throws `VALIDATION:{error1} | {error2}`.
- Issue route: maps `VALIDATION:` → 422, strips prefix for the client (Hebrew messages sent as-is).
- `NUMBERING_CONFLICT:` prefix also stripped → "מספור כפול — נסה שנית".
- Tests updated: all `issueDraft` mocks now include `items: [{ id: "item-1" }]`, `issueDate` set, `taxId: "515151"`.

VERIFICATION: npm test — 43/43. npx tsc --noEmit — clean.

---

## [2026-04-12] Compliance Task 3 — Audit Log

FILES:
- prisma/schema.prisma (AuditLog model added)
- prisma/migrations/20260412000003_add_audit_log/migration.sql (new)
- src/services/audit.service.ts (new)
- src/app/api/documents/route.ts (auditDocumentCreate wired)
- src/app/api/documents/[id]/issue/route.ts (auditDocumentIssue wired)
- src/app/api/documents/[id]/cancel/route.ts (auditDocumentCancel wired)
- src/app/api/payments/route.ts (auditPaymentAdd wired)
- src/app/api/payments/[id]/route.ts (auditPaymentDelete wired)
- src/services/payment.service.ts (deletePayment now returns the deleted payment for audit)

DONE:
- AuditLog table: id, entityType, entityId, action, userId?, businessId, payload (JSONB), createdAt. Indexed on businessId and (entityType, entityId).
- audit.service.ts: `audit()` is a fire-and-forget wrapper — always void, errors swallowed and logged to console.error. Five public helpers: auditDocumentCreate, auditDocumentIssue, auditDocumentCancel, auditPaymentAdd, auditPaymentDelete. Each passes a lightweight payload (type/number/amount/method).
- Logging never blocks main flow — all calls are fire-and-forget.

VERIFICATION: npx tsc --noEmit — clean. npm test — 43/43.

---

## [2026-04-12] Compliance Task 2 — Sequential Numbering Hardening

FILES: prisma/schema.prisma, prisma/migrations/20260412000002_document_number_unique/migration.sql, src/services/document.service.ts, src/app/api/documents/[id]/issue/route.ts

DONE:
- **Already correct (verified):** `issueDraft` uses `db.$transaction` — counter upsert + increment + document update are atomic. Number is assigned only inside the transaction that also sets status=ISSUED. A failed transaction rolls back the counter increment. Status is re-checked inside the transaction to block double-issue races.
- **Added:** `@@unique([businessId, number])` on the `Document` model in schema.prisma. Migration creates `CREATE UNIQUE INDEX "Document_businessId_number_key" ON "Document"("businessId", "number")`. PostgreSQL naturally allows multiple NULLs in a unique index — DRAFT documents (number=null) are unaffected; only issued documents with the same (businessId, number) pair are rejected.
- **Error handling:** `issueDraft` now catches `P2002` (unique constraint violation) and throws `NUMBERING_CONFLICT:Document number already exists — issue aborted`. Issue route maps `NUMBERING_CONFLICT:` → 409.
- `prisma generate` run — client types updated.

VERIFICATION: npx tsc --noEmit — clean (0 errors).

---

## [2026-04-12] Compliance Task 1 — Document Immutability

FILES: src/services/document.service.ts, src/app/api/documents/[id]/route.ts, src/services/document.service.test.ts

DONE:
- Service layer: `updateDraft` and `deleteDraft` now throw `IMMUTABLE:Document status is {status} — only DRAFT documents can be {edited|deleted}`. The `IMMUTABLE:` prefix is the machine-readable tag for callers.
- API layer: PATCH and DELETE routes load the document first (via `getDocumentById`). If status != DRAFT → return 409 with Hebrew error message before the service is even called. Defense-in-depth: API check + service check both enforce immutability independently.
- `errorStatus()` helper maps `IMMUTABLE:` → 409, "Only drafts" → 400, "not found" → 404.
- Cancel (status → CANCELLED) and credit note creation routes are unaffected — they have their own dedicated routes with appropriate guards.
- Tests updated to match new `IMMUTABLE:` error prefix.

VERIFICATION: npm run build — clean. npm test — 43/43.

---

## [2026-04-12] Phase: Compliance Hardening — all 4 tasks complete

AREA: Compliance / Financial Integrity

---

### Task 1 — Document Hash

* Done: SHA256 integrity hash added to every issued document.
* How: `computeIssuedDocumentHash()` in `document.service.ts` serialises type, number, issueDate, dueDate, customer snapshot, business snapshot, all item line fields (sorted by lineIndex), and totals into a canonical JSON string; SHA256 hex digest stored in `issuedHash CHAR(64)` on the Document record.
* Computed inside `issueDraft()` — only at issue time, never recomputed.
* Schema: `issuedHash String? @db.Char(64)` added to Document model.
* Migration: `prisma/migrations/20260412100000_add_document_issued_hash/migration.sql`
* Files: `prisma/schema.prisma`, `src/services/document.service.ts`

---

### Task 2 — Audit Log Immutability (DB-level)

* Done: PostgreSQL triggers prevent UPDATE and DELETE on the AuditLog table.
* Trigger function `prevent_audit_log_mutation()` raises an EXCEPTION for any UPDATE or DELETE attempt, including direct SQL access bypassing the ORM.
* Migration: `prisma/migrations/20260412100001_audit_log_immutability/migration.sql`
* Files: migration SQL only (no application code changes needed — service was already INSERT-only)

---

### Task 3 — DB-Level Document Protection

* Done: PostgreSQL trigger prevents physical DELETE of Document rows in financial states (ISSUED, PARTIALLY_PAID, PAID, CANCELLED).
* DRAFT and DELETED rows are not blocked — administrative purge of never-issued drafts remains possible.
* Trigger function `prevent_financial_document_delete()` raises an EXCEPTION with the document id and status on any blocked DELETE.
* Migration: `prisma/migrations/20260412100002_document_deletion_protection/migration.sql`
* Files: migration SQL only (no application code changes — app already uses soft-delete)

---

### Task 4 — Retention / Backup Policy

* Done: README updated with a new "Data Retention Policy" section documenting the 7-year retention requirement, what data it covers, DB-level safeguards, and off-site archival guidance including an S3 Glacier cron example.
* Backup script updated with a retention policy comment block explaining the 30-dump local rotation and the requirement for long-term off-site archival.
* Files: `README.md`, `scripts/db-backup.sh`

---

VERIFICATION: `npx tsc --noEmit` — clean, 0 errors.

---

## [2026-04-29] WhatsApp Redirect After Quote Approval

AREA: Customer flow / owner notification

### What changed

After a customer approves a quote, the success response now includes a
`https://wa.me/...` URL that opens a WhatsApp chat with the business owner
pre-filled with a Hebrew approval message. The client redirects via
`window.location.href` immediately after the success state is set. Calendar
event creation still runs first and is unaffected.

### Files

* `src/lib/documents/delivery.ts` — new `buildOwnerApprovalRedirectWhatsappMessage()`
  helper. Reuses the existing `normalizeWhatsappPhone()` (`050X → 972X`,
  `+972 → 972`, strips non-digits) and `buildWhatsappShareUrl()`.
* `src/lib/documents/delivery.test.ts` — added test asserting the exact
  message format and the em-dash (`—`) fallbacks.
* `src/services/document.service.ts` — `recordQuoteApproval()` now also
  returns `whatsappRedirectUrl: string | null`. Built by a new private
  `buildOwnerApprovalWhatsappRedirectUrl()` that:
  * loads `business.phone`, document `customerName`/`eventDate`/`eventTime`,
    and the customer phone,
  * formats `eventDate` via existing `formatDate()` and `eventTime` via
    `formatEventTime()`,
  * returns `null` if `business.phone` is missing — in that case the route
    keeps the existing success response with no redirect.
* `src/app/api/public/approve/[token]/route.ts` — passes
  `whatsappRedirectUrl` through to the JSON response.
* `src/app/approve/[token]/ApprovalForm.tsx` — when the response includes
  `whatsappRedirectUrl`, the success view sets `window.location.href = url`
  right after rendering success.

### Message format

```
הי ליאור
הצעת מחיר אושרה ✅

לקוח: {customerName}
טלפון: {customerPhone}
תאריך האירוע: {eventDate}
שעה: {eventTime}
```

Each missing field falls back to `—`.

### Constraints honored

* Approval still succeeds if WhatsApp URL build throws — wrapped in try/catch
  with a safe `console.error("[approval] build whatsapp redirect failed", error)`.
* Calendar creation runs before WhatsApp URL build and is not blocked by it.
* No external libraries; phone normalization reuses the existing util.
* Note: `CLAUDE.md` and `docs/CODEBASE_MAP.md` referenced in the task brief
  do not exist in this repo — work proceeded with `docs/RUNNING_SUMMARY.md`
  and the existing source as the source of truth.

### Verification

* `npm test` — 6 suites / 59 tests pass (1 new test added in delivery suite).
* `npm run build` — succeeds. Pre-existing `Dynamic server usage` notices on
  unrelated `/api/reports/*` routes are unchanged.

---
