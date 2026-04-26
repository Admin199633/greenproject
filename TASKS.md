# TASKS

## Rules

* Execute one task at a time
* Do not change core logic unless required
* Focus only on document correctness (PDF + data)
* Every rule must be enforced at backend level (not UI only)
* Append to PROJECT_SUMMARY_UPDATE.md after each task

---

## 1. Receipt (קבלה) Compliance ✓ DONE

### 1.1 Required Fields

* [x] Ensure every receipt includes:

  * document title = "קבלה" (already via DOCUMENT_TYPE_LABELS)
  * receipt number (sequential counter) ✓
  * receipt date (issueDate) ✓
  * business name ✓
  * business taxId ✓
  * customer name ✓
  * amount received (amountPaid in totals + "סה״כ התקבל" in payment section) ✓
  * payment method (new "פרטי תשלום" section) ✓

---

### 1.2 Payment Link

* [x] Ensure every payment is linked to a receipt (amountPaid recalculated by recalculateDocumentStatus)
* [x] Ensure receipt reflects actual paid amount (amountPaid = sum of payments)

---

### 1.3 Validation

* [x] Block receipt generation if:

  * payment method is missing or unrecognised → 400
  * no payment exists → 400

---

## 2. Invoice (חשבונית מס) Compliance ✓ DONE

### 2.1 Required Fields

* [x] title = "חשבונית מס" (DOCUMENT_TYPE_LABELS.INVOICE)
* [x] invoice number (sequential counter)
* [x] issue date (shown in header + details section)
* [x] business details (name, taxId, address in snapshot)
* [x] customer details (name, taxId, address in snapshot)
* [x] subtotal (PDF totals section)
* [x] VAT rate (shown in VAT row label as "מע״מ X%")
* [x] VAT amount (only if vatRateSnapshot > 0)
* [x] total amount

---

### 2.2 VAT Rules

* [x] exempt (osek_patur / vatRateSnapshot=0): VAT row hidden (conditional rendering)
* [x] authorized (osek_murshe / chevra): backend enforces vatRateSnapshot > 0 on INVOICE/INVOICE_RECEIPT at issue time → VALIDATION: error if violated

---

## 3. Invoice Receipt (חשבונית מס/קבלה) ✓ DONE (verified, no additional changes)

* [x] invoice fields — same rendering path as INVOICE (title, number, date, business/customer, VAT, totals)
* [x] receipt fields — "פרטי תשלום" section rendered for INVOICE_RECEIPT (Task 1)
* [x] payment method — shown per payment row in payment section
* [x] paid amount — "סה״כ התקבל" + "שולם" in totals
* [x] backend: PDF route blocks if no payments with valid method (Task 1.3)
* [x] backend: VAT enforcement applies to INVOICE_RECEIPT (Task 2.2)

---

## 4. Document Titles Enforcement ✓ DONE (verified, no changes needed)

* [x] QUOTE → "הצעת מחיר"
* [x] INVOICE → "חשבונית מס"
* [x] RECEIPT → "קבלה"
* [x] INVOICE_RECEIPT → "חשבונית מס / קבלה"
* [x] Hebrew renders correctly — full Heebo-Regular.ttf / Heebo-Bold.ttf (TTF, not WOFF subset); no encoding issues

---

## 5. Payment Method System ✓ DONE (verified, no changes needed)

* [x] Controlled const-enum: `PAYMENT_METHODS = ["cash", "bank_transfer", "credit_card", "check", "other"]` in `src/lib/validations/payment.ts`. Hebrew labels via `PAYMENT_METHOD_LABELS`.
* [x] Enforced at API: `createPaymentSchema` uses `z.enum(PAYMENT_METHODS)` — invalid method → 422.
* [x] Stored in DB: `Payment.method String` (NOT NULL).
* [x] Shown in PDF: `paymentMethodLabel()` in PDF template (Task 1) renders Hebrew label for each payment row.

---

## 6. PDF Content Enforcement ✓ DONE

* [x] business name — `valueOrDash(document.businessName ?? business.name)` — always shown
* [x] taxId — `valueOrDash(document.businessTaxId ?? business.taxId)` — always shown
* [x] document number — `document.number ?? document.id` — always shown (fallback to id for safety)
* [x] date — now unconditionally rendered in header via `formatDate(document.issueDate)` (returns "—" if null, but always present on issued docs)
* [x] customer name — `valueOrDash(customerName)` — always shown
* [x] totals — subtotal, VAT (conditional on vatRateSnapshot>0), total, paid, due — always rendered
* [x] Hebrew renders correctly — Heebo-Regular.ttf / Heebo-Bold.ttf, en-US locale (no Bidi marks)

---

## 7. Validation Layer (Critical) ✓ DONE (verified)

* [x] All compliance rules enforced at service/API level:
  - issueDraft: business name, taxId, issueDate, items≥1, VAT on authorized invoices
  - createPayment: z.enum method, amount>0, document eligibility, payment≤amountDue, idempotency
  - PDF route: RECEIPT/INVOICE_RECEIPT must have payments with valid methods
  - Business settings PATCH: name and taxId required (min 1)
* [x] No UI-only validation — all guards run server-side even if client sends malformed requests
* [x] Clear errors: VALIDATION: prefix → 422, Hebrew messages stripped for client; service errors with correct HTTP status codes

---

## 8. Verification ✓ DONE

* [x] Receipt — "פרטי תשלום" section with method, date, amount; "סה״כ התקבל"; blocked without payments
* [x] Invoice — VAT shown for osek_murshe; VAT hidden for osek_patur; authorized business blocked if vatRateSnapshot=0
* [x] Invoice_receipt — combined invoice + receipt sections; same PDF validations apply
* [x] Payment method — z.enum enforced at API; Hebrew labels in PDF
* [x] PDF correctness — all required fields unconditionally rendered; Hebrew TTF font
* [x] Build — CLEAN
* [x] Tests — 43/43 PASSED
