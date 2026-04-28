# Running Summary

## Online quote approval without login

Completed the missing customer-approval flow for issued quotes while keeping the existing issue/email/PDF logic in place. The feature now works end to end through a public approval page, a public approval API, dashboard status/actions, and customer-facing delivery links.

The approval flow now also supports an optional customer signature. Signature capture is available on the public approval page, remains login-free, and is saved alongside the existing approval metadata when provided.

The public approval page was also redesigned to feel more premium and boutique, with a warmer presentation layer and a clearer package/approval hierarchy. This was a UI-only change: approval logic, token/security flow, email/WhatsApp links, and PDF behavior were left intact.

### What was completed

- Added the missing client component `src/app/approve/[token]/ApprovalForm.tsx`.
- Finished the public approval page at `src/app/approve/[token]/page.tsx` so it:
  - shows a safe invalid-token message: `קישור האישור אינו תקין או שאינו זמין`
  - shows quote details + approval form for an unapproved issued quote
  - shows an already-approved state with `approvedByName` and `approvedAt` when available
  - keeps the public PDF download link available without login
- Added a quote-only authenticated route `POST /green/api/documents/[id]/approval-link` to mint a fresh approval token and return a full approval URL for dashboard actions.
- Updated the issued document dashboard actions so issued quotes now support:
  - approval status display
  - `העתקת קישור אישור`
  - WhatsApp sharing that includes an approval link for issued, unapproved quotes
- Updated manual email sending so customer resend of an issued quote also includes a fresh approval link.
- Kept the existing public PDF token flow and existing PDF behavior unchanged.
- Added optional signature capture and storage for quote approvals.
- Redesigned the public approval page presentation and layout.

### Files changed

- `src/app/approve/[token]/ApprovalForm.tsx` (new)
- `src/app/approve/[token]/page.tsx`
- `src/app/api/public/approve/[token]/route.ts`
- `src/app/api/documents/[id]/approval-link/route.ts` (new)
- `src/components/documents/DocumentShareActions.tsx`
- `src/app/(dashboard)/documents/[id]/page.tsx`
- `src/services/email.service.ts`
- `prisma/schema.prisma`
- `src/services/document.service.ts`
- `src/app/approve/[token]/page.tsx`
- `src/app/approve/[token]/ApprovalForm.tsx`
- `docs/RUNNING_SUMMARY.md`

### Approval token flow

- Approval tokens are still generated with `randomBytes(32)` and are long and unguessable.
- Only the SHA-256 hash is stored in `Document.approvalTokenHash`; the raw token is never stored in the DB.
- Issue-time quote emails still use the existing issue flow.
- When a later dashboard action needs a customer approval link and the raw token is no longer available, the new authenticated route mints a fresh token and returns the approval URL.
- Minting a fresh token replaces the old hash in the document row, invalidating the old approval link without storing any raw token.
- Raw tokens are not logged.

### Approval page behavior

- Public approval page works without login.
- It only resolves tokens that belong to `ISSUED` `QUOTE` documents.
- Invalid / wrong-type / wrong-status / expired cases collapse to the same safe message.
- The page now uses a premium hero / proposal layout instead of a generic admin-style card stack.
- `בתוקף עד` was removed from the public approval page.
- The approval form now includes:
  - required full name
  - required approval checkbox
  - optional signature area labeled `חתימה`
  - `נקה חתימה` action
- Signature can be drawn with finger or mouse and is mobile-friendly.
- If the quote is already approved, the form is hidden and the page shows:
  - `הצעת המחיר כבר אושרה`
  - `approvedByName` when present
  - `approvedAt` when present
- If the quote is not approved, the page shows:
  - business details
  - quote number
  - issue date
  - customer details
  - event details when present
  - service/items summary with 24-hour event time formatting
  - package-level price summary only (`כמות`, `מחיר יחידה`, `סה"כ לחבילה`)
  - terms and conditions behind a modal trigger instead of a long inline block
  - a simple public PDF download button instead of a large dedicated PDF card
  - approval form with checkbox + full name
  - required signature pad before submit

### Approval page redesign

- Replaced the simple header with a premium hero card that shows:
  - business name
  - `הצעת מחיר`
  - quote number
  - issue date
- Added a more elegant approval-state presentation:
  - premium success banner after approval
  - subtle pre-approval notice before approval
- Merged customer / event information into cleaner visual detail cards.
- Improved mobile spacing, hierarchy, and card rhythm while keeping RTL and avoiding horizontal overflow.
- Moved `תנאים והערות` from an inline section into a scrollable modal / bottom-sheet trigger to shorten the mobile page.
- Removed the duplicate aside total summary card so the page keeps only the package card summary.
- Normalized event-time display to a consistent 24-hour format across the approval page, dashboard document view, and quote PDF.
- Changed the quote approval share action so `העתקת קישור אישור` now opens WhatsApp with a prefilled approval message and falls back to `wa.me/?text=...` when no phone is available.
- Made customer signature required in the public approval form and added the validation message `יש לחתום לפני אישור ההצעה`.
- Removed the full `קובץ ההצעה` card from the approval page and kept only a lightweight `צפייה / הורדת PDF` button.

### Service package parsing and display

- The public approval page no longer renders the item description as one plain text block.
- For each quote item:
  - the first non-empty line is treated as the package/service title
  - remaining lines are rendered as clean bullets
  - quantity, unit price, and line total are shown in a separate price summary area
- This gives the selected package a more boutique proposal feel, especially for photography quote packages.

### Signature behavior

- Signature is optional in this version to keep the flow stable.
- If provided, it is sent as a `data:image/...;base64,...` string and saved on the document.
- If omitted, approval still succeeds as long as the checkbox and full name are provided.
- Dashboard issued-quote page now shows a small signature preview when the quote has been approved with a signature.
- Quote PDF generation was not changed, so existing PDF behavior remains intact.

### DB field added

- `Document.approvalSignatureDataUrl String? @db.Text`

### Dashboard status and action behavior

- Issued `QUOTE` pages now show approval status only for quotes:
  - `ממתינה לאישור לקוח`
  - `אושרה על ידי <name> בתאריך <date>` when approved
- Non-quote documents do not show approval status or approval actions.
- Issued, unapproved quotes now show `העתקת קישור אישור` in the existing action area, alongside the existing PDF/email/WhatsApp actions.

### Email and WhatsApp behavior

- Issue-time document email flow remains in place.
- For `QUOTE` documents:
  - business email copy includes the approval link during issue-time delivery
  - customer email copy includes the public PDF link and the approval link
  - manual customer resend also mints/includes a fresh approval link when the quote is still unapproved
  - WhatsApp sharing includes the public PDF link and approval link for issued, unapproved quotes
- Customer-facing flows do not send dashboard/app-login links.

### Public PDF behavior

- Public PDF access still uses the existing HMAC token derived from `document.id` + `issuedHash`.
- The approval page builds its PDF link with that existing mechanism.
- The public approval page PDF action now uses a plain anchor instead of `next/link` for this internal public-file URL, which avoids the double `/green/green/api/...` issue under the app base path.
- Draft documents are still not exposed.
- Unrelated documents are still not exposed.

### Security

- Signature payloads are not logged.
- The approval API only accepts image data URLs for signatures.
- Signature payload size is capped to reject oversized submissions.
- Signature can only be saved during the first successful approval because double approval remains blocked.

### Required DB command

Production still needs the Prisma schema sync for the approval columns:

```bash
npx prisma db push
```

Do not run destructive DB operations.

### Verification

- `npm run build`
- `npx tsc --noEmit`

### Manual test checklist

1. Create quote draft.
2. Issue quote.
3. Confirm PDF still downloads.
4. Confirm customer email includes approval link if customer email exists.
5. Confirm business email includes approval link.
6. Open approval link in incognito.
7. Verify quote can be viewed without login.
8. Approve with checkbox + full name.
9. Verify success message.
10. Reopen same link and verify already-approved message.
11. Verify dashboard quote page shows approved status.
12. Verify WhatsApp message includes approval link.
13. Verify non-quote documents do not show approval flow.
14. Open approval link on mobile, sign with finger, approve, and reload the link.
15. Verify dashboard shows the saved signature preview.

## Forgot password / reset password flow

A user who cannot remember their password can now request a reset email and pick a new password from a one-time, time-limited link. Existing login and registration flows are unchanged.

### Schema additions (`User`)

- `resetPasswordTokenHash String?` — SHA-256 hex digest of the active reset token. Indexed for the lookup. The raw token is **never** stored.
- `resetPasswordExpiresAt DateTime?` — set to `now + 30 minutes` when a token is issued; both fields are cleared after a successful reset.

### Required DB sync command

After pulling these changes, run:

```
npx prisma generate
npx prisma db push
```

`db push` adds the two nullable columns and the new index on `resetPasswordTokenHash`; existing rows default to `NULL` so users without an active reset link are unaffected.

### Reused env vars

The reset email reuses the existing SMTP setup — no new variables are introduced:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `NEXTAUTH_URL` — used to build the absolute `https://<host>/green/reset-password?token=…` link in the email. If not configured, the helper falls back to `https://liorsw.com`.

### Endpoints

- `POST /green/api/auth/forgot-password`
  - Body: `{ email: string }` (zod-validated, lowercased before lookup).
  - Response is **always** `{ message: "אם קיים חשבון עם כתובת זו, נשלח אליו קישור לאיפוס סיסמה." }` with HTTP 200, regardless of whether a user exists, whether SMTP succeeded, or whether the body was malformed. This makes the endpoint impossible to use as an email-existence oracle.
  - When the email matches a user, a fresh 32-byte random token is generated, hashed with SHA-256, and stored together with `expiresAt = now + 30min`. The raw token is sent only via email and is never logged.
  - Email send failures are caught and logged as `[auth:forgot-password] email send failed` without including the token or URL.

- `POST /green/api/auth/reset-password`
  - Body: `{ token: string, password: string, confirmPassword: string }`.
  - Validation: password ≥ 6 chars, passwords must match.
  - Token verification: hashes the submitted token, looks up the user with that hash and `resetPasswordExpiresAt > now()`. On miss, returns 400 with `הקישור לא תקין או שתוקפו פג. יש לבקש קישור חדש.`.
  - Password update reuses the same `bcrypt.hash(password, 12)` salt rounds as registration / login.
  - Single-use guarantee: the password and token are written via `db.user.updateMany` whose where-clause still includes the token hash + expiry. A racing second request finds 0 matching rows after the first one clears the token, so the same link cannot be reused.
  - On success, both `resetPasswordTokenHash` and `resetPasswordExpiresAt` are cleared.

### Pages

- `/green/login` — added the link **שכחתי סיסמה** under the password field, plus a green success banner when the URL contains `?passwordReset=1`. Existing form behavior is unchanged.
- `/green/forgot-password` — single-field email form. After submit (success or network failure) the page swaps to the generic confirmation message and a "חזרה להתחברות" link. The page never reveals whether the email matched an account.
- `/green/reset-password?token=…` — new-password + confirm-password form. Missing token shows a Hebrew error and a link back to `/forgot-password`. On a successful reset, the page redirects to `/login?passwordReset=1`.

### Files added / changed

- `prisma/schema.prisma` (`User.resetPasswordTokenHash`, `User.resetPasswordExpiresAt`, index)
- `src/lib/auth/password-reset.ts` (server-only — token generation, SHA-256 hashing, reset-URL builder, SMTP transport, Hebrew email HTML/text)
- `src/app/api/auth/forgot-password/route.ts` (new)
- `src/app/api/auth/reset-password/route.ts` (new)
- `src/app/(auth)/forgot-password/page.tsx` (new)
- `src/app/(auth)/reset-password/page.tsx` (new)
- `src/app/(auth)/login/page.tsx` (link to `/forgot-password`, `?passwordReset=1` banner)
- `docs/RUNNING_SUMMARY.md`

### Security guarantees recap

- Raw reset tokens are never persisted — only the SHA-256 hash is stored.
- Tokens are not logged. Console errors avoid the token, the reset URL, and the user id.
- The `forgot-password` endpoint always returns the same generic message, so it cannot be used to enumerate accounts.
- Tokens expire 30 minutes after issuance.
- Tokens are single-use: the `updateMany` guard prevents reuse even under concurrent requests.
- The reset endpoint hashes the new password with `bcrypt` at the same cost (`12`) as registration/login.

### Manual test checklist

1. Apply the schema: `npx prisma generate && npx prisma db push`.
2. Visit `/green/login` — confirm the new "שכחתי סיסמה" link sits under the password field.
3. Click the link → arrives at `/green/forgot-password`.
4. Submit an email that **exists** in `User`. The page swaps to the generic success message. The configured SMTP inbox receives a Hebrew email with a "איפוס סיסמה" button + 30-minute expiration notice + a "אם לא ביקשת" disclaimer.
5. Click the email button — lands on `/green/reset-password?token=…`. Set a new password, confirm, submit → redirected to `/green/login?passwordReset=1` with the green "הסיסמה עודכנה בהצלחה" banner.
6. Log in with the new password — succeeds.
7. Log in with the old password — fails with the existing "אימייל או סיסמה שגויים" error.
8. Open the same reset link a second time → the page still renders, but submitting returns the safe error `הקישור לא תקין או שתוקפו פג. יש לבקש קישור חדש.` (single-use enforcement).
9. In Prisma Studio, set a user's `resetPasswordExpiresAt` to a past date and visit a fresh link with the corresponding token → submit shows the same safe error (expiry enforcement).
10. Submit the forgot-password form with an email that **does not exist** in `User`. The same generic message appears; check Supabase that no `resetPasswordTokenHash` was written for any user; check the SMTP inbox that no email was sent.
11. Tamper with the token in the URL (change a few characters) → submit returns the safe error.
12. Submit the reset form with mismatched passwords or a 5-char password → client- and server-side validation both reject before any DB write.

## Configurable quote terms ("אותיות קטנות")

A business can now define a default block of terms / "small print" text that is automatically attached to every new quote ("הצעת מחיר") at creation time and rendered at the bottom of the quote PDF.

### Schema changes

- `Business.quoteTermsText String? @db.Text` — the editable default text managed from `/green/settings`.
- `Document.quoteTermsText String? @db.Text` — the snapshot stored on the document at creation time. Once the quote exists this column is the source of truth for that quote's terms; later edits to the business default never reach back to existing quotes.

### Required DB sync command

Run after pulling these changes:

```
npx prisma generate
npx prisma db push
```

`db push` adds the two nullable text columns; no data migration is required. Existing rows simply default to `NULL` (no terms shown).

### Settings UI

- New section in `/green/settings` → "פרטי העסק" form: **הצעות מחיר**.
- Field: `<textarea name="quoteTermsText">` with label `אותיות קטנות להצעת מחיר` and helper `הטקסט יופיע אוטומטית בכל הצעת מחיר חדשה.`.
- Saved through the existing `PATCH /api/business` route (`businessSchema` now accepts `quoteTermsText`, max 10,000 chars, optional).
- Empty input is normalised to `NULL` in the DB.

### Copy-into-document behaviour

- `createDraft(businessId, data)` in `src/services/document.service.ts` now reads `business.quoteTermsText` inside the same transaction **only when** `data.type === DocumentType.QUOTE`, and writes it onto the new document's `quoteTermsText` column. Trim normalises whitespace; an empty/whitespace-only business value yields `NULL`.
- `updateDraft` deliberately leaves `quoteTermsText` untouched. The terms snapshot is set at creation and is not re-pulled when the user edits a draft, so editing a draft after the business default changes does not silently rewrite the quote's terms.
- `duplicateDocument` preserves the source document's `quoteTermsText` (consistent with how `notes`, event fields, etc. are duplicated).
- `createDocumentFromQuote` does not copy the field — the target is an `INVOICE` / `RECEIPT` / `INVOICE_RECEIPT`, none of which render terms.
- Existing issued quotes are untouched. Only quotes created after the schema is applied will populate `quoteTermsText`.

### Quote PDF placement

- `src/lib/pdf/document-pdf.tsx` — `QuotePage` now renders a "הערות ותנאים" block under the existing notes block, before the fixed footer. **Other document types are unaffected**; the legacy invoice / receipt / credit-note layout does not render this section.
- Visual rules (per spec):
  - title `הערות ותנאים`, brand-blue, 11 pt bold, RTL right-aligned
  - body in a smaller 8.5 pt muted slate text, RTL, 1.6 line-height, paragraph spacing
  - separated from the rest of the document by a thin top divider + 28 pt margin so it never feels squeezed into the main quote layout
  - paragraphs are split on blank lines (`/\r?\n+/`) so the user's line breaks are respected
- Pagination rules:
  - the title + first paragraph are wrapped in `<View wrap={false}>` so the heading is never orphaned at the very bottom of a page
  - subsequent paragraphs are siblings, not nested in the no-wrap view, so a long terms block flows naturally onto a new page when the current page runs out of room
  - the existing fixed page footer continues to render on every page, including the overflow page
- Field is rendered **only when** `document.quoteTermsText` is non-empty after `sanitizeText`. Quotes that pre-date the schema change (or that were created when the business had no default) render exactly as before.

### Form UI

- The quote form does **not** expose `quoteTermsText` as an editable field. Per spec, terms are managed only from `/green/settings`.

### Files changed

- `prisma/schema.prisma` (`Business.quoteTermsText`, `Document.quoteTermsText`)
- `src/lib/validations/business.ts` (`quoteTermsText` field on `businessSchema`)
- `src/services/business.service.ts` (writes `quoteTermsText` on update; trims empty → null)
- `src/services/document.service.ts` (`createDraft` snapshots `business.quoteTermsText` for QUOTE; `duplicateDocument` preserves the source value)
- `src/app/(dashboard)/settings/page.tsx` (forwards `business.quoteTermsText` into the form's default values)
- `src/app/(dashboard)/settings/BusinessSettingsForm.tsx` (textarea + section heading + helper text; sends value through PATCH)
- `src/lib/pdf/document-pdf.tsx` (new `quote.termsWrap` / `quote.termsTitle` / `quote.termsParagraph` styles; terms block rendered at the bottom of `QuotePage`)
- `docs/RUNNING_SUMMARY.md`

### Verification

- `npx prisma generate` — clean.
- `npx tsc --noEmit` — clean.
- `npm run build` — clean (the pre-existing `DYNAMIC_SERVER_USAGE` notices on auth-protected API routes are unrelated to this change).

### Manual smoke checklist

1. `/green/settings` → "פרטי העסק" → scroll to the new "הצעות מחיר" card. Enter a multi-paragraph terms text, save, and reload the page — the textarea is repopulated.
2. Create a new draft with `type = QUOTE`. In Prisma Studio (or DB) confirm the new `Document` row has `quoteTermsText` matching the saved business value.
3. Create a non-quote draft (e.g. INVOICE). Confirm `quoteTermsText` on that row is `NULL`.
4. Update the settings textarea to a different value. Confirm the existing quote draft from step 2 still has the *original* snapshot — it does not silently change.
5. Issue the quote draft and download the PDF. Confirm the "הערות ותנאים" section appears at the bottom of the quote, in small RTL Hebrew, separated from the totals/notes by a thin divider.
6. Save a very long terms text (e.g. 30+ short paragraphs). Issue + download a quote. Confirm the block continues onto a new page rather than being cut off, and that the fixed page footer still appears on the overflow page.
7. Clear the textarea, save, and create a new quote — confirm the PDF renders without the terms section at all.

## Issued document email + quote follow-up drafts + receipt workflow

### Files changed

- `prisma/schema.prisma`
- `src/lib/validations/document.ts`
- `src/lib/validations/payment.ts`
- `src/services/document.service.ts`
- `src/services/email.service.ts`
- `src/components/documents/DocumentForm.tsx`
- `src/components/documents/CreateFromQuoteButton.tsx`
- `src/app/api/documents/[id]/issue/route.ts`
- `src/app/api/documents/[id]/create-from-quote/route.ts`
- `src/app/(dashboard)/documents/[id]/page.tsx`
- `src/app/(dashboard)/documents/[id]/edit/page.tsx`
- `src/lib/pdf/document-pdf.tsx`
- `src/app/api/public/documents/[id]/pdf/route.ts`
- `src/services/document.service.test.ts`
- `docs/RUNNING_SUMMARY.md`

### Email rules

- Automatic issue email now always runs after a successful issue attempt via `POST /api/documents/[id]/issue`.
- Automatic issue delivery targets:
  - `business.email` when it exists
  - `customer.email` when it exists
- Automatic issue delivery is non-blocking. If sending fails, issuing still succeeds and the route logs:
  - `console.error("[documents:email] failed", error)`
- Manual `שליחה במייל` still uses `POST /api/documents/[id]/send` with `audience: "customer"`, so it sends only to the customer and never sends a duplicate owner copy.
- Edge case fix: if `business.email` is missing but `customer.email` exists, the customer still receives the automatic issue email. We now fail only when no recipient email exists at all.

### Quote to invoice / receipt flow

- Added `POST /api/documents/[id]/create-from-quote`.
- Supported targets:
  - `INVOICE`
  - `RECEIPT`
  - `INVOICE_RECEIPT`
- Constraints:
  - source must be an `ISSUED` `QUOTE`
  - `INVOICE_RECEIPT` is blocked for `osek_patur`
- On `/green/documents/[id]`, issued quote pages now show:
  - `צור חשבונית`
  - `צור קבלה`
  - `צור חשבונית קבלה` when supported
- Clicking an action creates a new draft and redirects to `/green/documents/<newId>/edit`.
- Prefilled into the new draft:
  - existing `customerId` from the quote, so no duplicate customer is created
  - customer name / phone / email through the existing edit-form seeding
  - event fields
  - line items
  - totals
  - notes / internal notes
  - `relatedDocumentId = quote.id`
- The original quote is never mutated.

### Receipt fields and issue flow

- Added focused receipt-draft fields on `Document`:
  - `receiptAmountReceived`
  - `receiptPaymentMethod`
  - `receiptPaymentReference`
  - `receiptCheckNumber`
  - `receiptCheckBank`
  - `receiptCheckBranch`
  - `receiptCheckAccount`
  - `receiptCheckDueDate`
  - `relatedDocumentId`
- Added matching check-detail fields on `Payment` so issued receipt PDFs can render real payment metadata instead of collapsing everything into a generic note.
- Receipt form UI now includes a dedicated `פרטי תשלום` card on `RECEIPT` and `INVOICE_RECEIPT` drafts.
- Required on receipt-like drafts:
  - `סכום שהתקבל`
  - `אמצעי תשלום`
- Conditional UI:
  - `שיק` shows check number / bank / branch / account / due date
  - `העברה בנקאית` / `אשראי` / `ביט` / `פייבוקס` show reference number
- Currency remains the document currency and defaults to `ILS`.
- When a receipt-like draft is issued:
  - the document still gets its sequential document number normally
  - payment details are validated before issue
  - a matching `Payment` row is created atomically inside the same transaction
  - `amountPaid`, `amountDue`, and document status are updated from the issued receipt payment
- This keeps receipts editable as drafts before issue while still preserving the existing payment-reporting model after issue.

### Receipt PDF

- Receipt / invoice-receipt PDFs now include:
  - title from the document type
  - receipt number
  - issue date
  - business details
  - customer details including phone
  - payment method
  - payment reference or full check details when present
  - total amount received from the payment summary row
  - related document number when created from an existing quote / invoice
  - notes when present
- For `osek_patur` receipts:
  - VAT rows stay hidden when `vatRateSnapshot = 0`
  - `INVOICE_RECEIPT` creation from quote is blocked
  - PDF labels avoid forcing `חשבונית מס` for exempt invoice-like output

### Known limitations

- Existing `sourceDocumentId` remains reserved for the one-to-one credit-note flow.
- Quote / invoice linkage uses the new non-unique `relatedDocumentId` instead of reusing `sourceDocumentId`, because `sourceDocumentId` is currently `@unique` and already drives `creditNote`.
- Manual browser verification was not performed in this session. The requested manual checklist is still pending in a live app session:
  - issue quote -> business email sent
  - issue quote with customer email -> customer email sent
  - manual customer email sends only to customer
  - open issued quote -> create receipt from it
  - receipt opens with customer / items / amounts prefilled
  - issue receipt
  - receipt PDF contains payment details
  - app works under `/green`

### Verification run

- `npx prisma generate`
- `npx tsc --noEmit`
- `npm run build`
- `npm test -- --runInBand`

## Files changed

- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/lib/auth.ts`
- `docs/RUNNING_SUMMARY.md`

## Registration flow added

- Added a visible `הרשמה` action under the existing login form.
- Added a new `/register` page with `email`, `password`, and `confirm password` fields.
- Added `POST /api/auth/register` to validate input, reject duplicate emails, hash the password with `bcryptjs` using 12 salt rounds, and create a Prisma `User` record.
- Successful registration redirects back to `/login?registered=1`, where the login page shows a success message.
- Login behavior is preserved; the login page still posts to the existing auth login route. The login and register pages now use basePath-safe navigation and relative API calls so they work under `/green`.

## How to test locally

1. Install dependencies with `npm install`.
2. Configure `.env` and `.env.local` with your existing database and auth values. Do not commit those files.
3. Start the app with `npm run dev`.
4. Open `http://localhost:3000/green/login`.
5. Click `הרשמה`, create a new account, and confirm you are redirected back to `http://localhost:3000/green/login?registered=1`.
6. Verify in your database or Prisma Studio that a new row exists in the `User` table and that `passwordHash` is a bcrypt hash rather than plain text.
7. Log in with the new account from `/green/login` and confirm the app authenticates successfully.

## Registration now creates default business context

- The dashboard requires a `Business` for the signed-in user (see `requireBusiness` in `src/services/auth.service.ts`). Previously, `POST /api/auth/register` only created a `User`, so post-login the dashboard crashed with `No business associated with this account`.
- `POST /api/auth/register` now creates the `User` and an associated `Business` in a single Prisma nested write (atomic), with default `name = "העסק שלי"`. All other `Business` fields rely on schema defaults (`taxType`, `businessType`, `vatRate`, `currency`, number prefixes, etc.).
- Existing zod validation, duplicate-email handling, and bcrypt password hashing (12 rounds) are unchanged.

### Files changed

- `src/app/api/auth/register/route.ts`
- `docs/RUNNING_SUMMARY.md`

### Test steps

1. From `/green/login`, click `הרשמה` and register a fresh email.
2. In the database (or Prisma Studio) confirm a new `User` row and a matching `Business` row whose `ownerUserId` equals the new user's `id` and whose `name` is `העסק שלי`.
3. Log in with the new credentials and confirm `/green/dashboard` loads without the `No business associated with this account` error.
4. Try registering again with the same email and confirm the request still returns `409` with the existing duplicate-email message.

## Inline customer entry on document creation

- The "create document" form no longer has a customer dropdown or a separate "create customer" screen. The top of the form now collects customer details directly: שם הלקוח (required), טלפון (required), אימייל (optional, validated when present).
- On save, `POST /api/documents` (and `PATCH /api/documents/:id`) resolves the customer inside the same Prisma transaction that creates the document:
  1. Look up an existing `Customer` for the current `businessId` whose `phone` matches the submitted phone OR (when an email is supplied) whose `email` matches the submitted email — oldest match wins so the dedupe choice is deterministic.
  2. If found, reuse it. If not, create a new `Customer` (`fullName` ← submitted name, `phone`, `email`).
  3. Create the `Document` with `customerId` pointing at the resolved customer.
- All of the above happens inside `db.$transaction`, so a failure to create the document also rolls back the customer creation.
- Schema: `Customer` now has `@@unique([businessId, phone])` and `@@unique([businessId, email])`. Postgres treats `NULL`s as distinct, so the constraints only apply when the field is set — this matches the desired "dedupe by phone or email per business" rule and won't block customers without one of the contact fields.
- Validation still rejects:
  - missing name
  - missing phone
  - malformed email when one is provided
- Edit-draft flow is unchanged in behavior: the form is now seeded from the existing customer's name/phone/email, and saving runs the same find-or-create resolver — so editing without changing contact details keeps the same `customerId`, while changing phone/email re-resolves to (or creates) a different `Customer`.
- The credit-note guard `Credit note customer cannot be changed` still fires inside the transaction if the resolved customer differs from the source document's customer.

### Files changed

- `prisma/schema.prisma` (Customer unique constraints)
- `src/lib/validations/document.ts` (replaced `customerId` with `customerName`/`customerPhone`/`customerEmail`)
- `src/services/document.service.ts` (new `resolveCustomer` helper, used in `createDraft` and `updateDraft`)
- `src/components/documents/DocumentForm.tsx` (new top-of-form customer card; dropdown removed)
- `src/app/(dashboard)/documents/new/page.tsx` (no longer fetches customer list)
- `src/app/(dashboard)/documents/[id]/edit/page.tsx` (seeds form from `doc.customer`)
- `src/services/document.service.test.ts` (fixture updated to new schema; transaction mock includes `customer`)
- `docs/RUNNING_SUMMARY.md`

### Pre-flight (when deploying)

If your `Customer` table contains rows with duplicate `(businessId, phone)` or `(businessId, email)` from before this change, `prisma db push` will fail to apply the new unique constraints. Resolve duplicates first (merge or null one side) and rerun `npx prisma db push`.

### Test steps

1. `npx prisma generate && npx prisma db push` to apply the schema changes.
2. `npm run dev` and log in.
3. Go to `Documents → מסמך חדש`. Confirm the new "פרטי הלקוח" card appears at the top with name/phone/email — and that the old `לקוח` dropdown is gone.
4. Fill in name = "ישראל ישראלי", phone = "050-1111111", add a line item, save the draft. Confirm the draft is created.
5. In Supabase (or Prisma Studio), open the `Customer` table and verify a new row exists with `fullName="ישראל ישראלי"`, `phone="050-1111111"`, scoped to your `businessId`. Note its `id`.
6. Open the saved document; verify `customerId` matches the new row.
7. Create another document with the same phone (`050-1111111`) but a different name. Save. Confirm in `Customer` that **no new row was created** — the existing customer was reused — and the second document's `customerId` matches the same row.
8. Create a third document with a brand-new phone but reusing the same email as customer #1. Confirm again that the existing customer is reused (matched by email).
9. Try saving with an empty phone or with a malformed email — both should be rejected with field-specific errors.

## Settings save fixes + customer phone-primary sync

Three related fixes shipped together:

### 1. Customer lookup is now phone-primary, with field sync

- `resolveCustomer` (in `src/services/document.service.ts`) used to match by phone OR email. It now matches **only on `(businessId, phone)`**. Phone is required by both client and server.
- When an existing customer is found:
  - if the form sent a non-empty `customerName`, it updates `fullName`.
  - if the form sent a non-empty `customerEmail`, it updates `email`.
  - empty submitted fields keep the previously stored value.
- When no customer is found, a new `Customer` row is created with `fullName`, `phone`, `email`, scoped to `businessId`.
- All of this still happens inside the same `db.$transaction` as the document write, so a failed document insert rolls back the customer side too.
- The `@@unique([businessId, email])` constraint added in the previous round was **dropped** — email is now informational, not a key, so two customers in the same business can legitimately share an email. `@@unique([businessId, phone])` is kept and remains the dedupe key.

### 2. /settings business save: 404 → working

- Root cause: `BusinessSettingsForm` posted to `/api/business`. With `basePath: "/green"` in `next.config.mjs`, the API is served at `/green/api/business` and the un-prefixed request 404'd. The fallback `setServerError(json.error ?? "שגיאת שרת")` showed the generic Hebrew error.
- Fix: introduced `src/lib/api-base.ts` exporting `API_BASE = "/green/api"`. `BusinessSettingsForm` now calls `${API_BASE}/business`.
- The PATCH route was otherwise correct — payload field names, zod schema (`businessSchema`), and Prisma `Business` model all already aligned.
- The route also now distinguishes auth/no-business errors (401 / 409) from real server errors (500), logs failures with the prescribed prefix `console.error("[settings:business] failed", error)`, and includes the underlying message in `detail` on the 500 JSON body for easier debugging.

### 3. /settings saved items save: optional description + 404 fix

- Root cause was twofold:
  1. Same basePath problem — `/api/saved-items` 404'd; toast fell back to "שגיאה בשמירה".
  2. `description` was required on the client (`!description.trim()` blocked the submit), in zod (`.min(1)`), in the service (`data.description.trim()`), and in Prisma (`description String`). The user spec is `description: optional`.
- Fixes:
  - `SavedItemsManager` now uses `${API_BASE}/saved-items` for POST and DELETE; the description label is `תיאור (אופציונלי)`; the client-side blocker is replaced with `name` required + `defaultPrice` required.
  - `savedItemSchema` now accepts an empty/missing `description`.
  - `createSavedItem` / `updateSavedItem` write `null` when description is empty.
  - Prisma `SavedItem.description` is now `String?`.
  - The DELETE button uses the same `API_BASE` so item removal also works under `/green`.
  - The POST/GET route logs failures as `[settings:saved-items] failed` and surfaces `detail` on 500 responses.
- The DocumentForm "+ הוסף מפריט שמור" picker also tolerates a null description (it falls back to the saved item's name).

### Files changed

- `prisma/schema.prisma` (drop `@@unique([businessId, email])` on Customer; `SavedItem.description` → `String?`)
- `src/lib/api-base.ts` (new — basePath-safe `API_BASE`)
- `src/lib/validations/savedItem.ts` (description optional)
- `src/services/savedItem.service.ts` (write null on empty description)
- `src/services/document.service.ts` (`resolveCustomer` is phone-primary + syncs name/email)
- `src/app/api/business/route.ts` (auth-aware error mapping; `[settings:business]` log)
- `src/app/api/saved-items/route.ts` (auth-aware error mapping; `[settings:saved-items]` log)
- `src/app/(dashboard)/settings/BusinessSettingsForm.tsx` (uses `API_BASE`)
- `src/app/(dashboard)/settings/SavedItemsManager.tsx` (uses `API_BASE`; description optional)
- `src/components/documents/DocumentForm.tsx` (uses `API_BASE`; null-safe saved-item description)
- `src/services/document.service.test.ts` (tx mock now includes `customer.update`)
- `docs/RUNNING_SUMMARY.md`

### DB changes required

After pulling these changes run:

```
npx prisma generate
npx prisma db push
```

`db push` drops the `Customer_businessId_email_key` unique index and changes `SavedItem.description` to nullable. No data is lost; `description` rows that were previously `''` stay as `''`.

### Test checklist

**Customer phone-primary + sync (Part 1)**

1. `/green/documents/new` — fill customer name `דנה לוי`, phone `050-1111111`, leave email empty, add a line item, save. Confirm a new `Customer` row exists with `fullName="דנה לוי"`, `phone="050-1111111"`, `email=null`.
2. Create another draft with phone `050-1111111`, name `דנה לוי-כהן`, email `dana@example.com`. Save. In the DB the **same** customer row now has `fullName="דנה לוי-כהן"` and `email="dana@example.com"`. Both documents' `customerId` point to that single row.
3. Create another draft with phone `050-1111111` and **empty** email. Save. The stored email stays `dana@example.com` (empty fields don't overwrite).
4. Confirm `Customer` table has exactly one row for that `(businessId, phone)`.

**/settings business save (Part 2)**

1. `/green/settings`. Change name, phone, VAT rate, invoice prefix. Click שמור שינויים.
2. Expect a green הפרטים נשמרו בהצלחה. Reload `/green/settings` — values persisted.
3. Verify the `Business` row in Supabase matches.
4. Force a 500 (e.g., temporarily break the schema) and verify the response body contains `{ error: "שגיאת שרת", detail: "<original message>" }` and the server log shows `[settings:business] failed ...`.

**/settings saved items save (Part 3)**

1. `/green/settings` → "פריטים שמורים". Add `שם=חבילת סילבר`, `מחיר=1000`, leave unit + description empty. Click הוסף פריט.
2. Toast: "הפריט נשמר". Item appears in the list with `₪1000.00` and no description.
3. Reload `/green/settings` — item is still there.
4. Verify Supabase `SavedItem` has the row, `businessId` matches the current user's business, and `description IS NULL`.
5. Add a second item with a description filled in — confirm description is stored and rendered.
6. Delete an item — confirm it disappears and the row is removed from the DB.

## Document issue ("הנפק") fix

**Root cause:** the same `/green` basePath bug as the settings forms. `IssueDraftButton` posted to `/api/documents/${id}/issue`, which 404'd under `/green`. The button's fallback toast then displayed the generic "שגיאה בהנפקה", masking what was actually a 404.

The underlying `issueDraft` service flow was already correct end-to-end with the new customer auto-create logic — it loads `doc.customer` via the relation, uses `snapshotCustomerName(doc.customer)` for the snapshot, and tolerates null `customer.address` / `customer.taxId` (the issue-time validation only requires the *business's* `name` + `taxId`, never the customer's). No service-level change was needed.

### Files changed

- `src/components/documents/IssueDraftButton.tsx` — fetch now uses `${API_BASE}/documents/${id}/issue`, so the request goes to `/green/api/...`.
- `src/app/api/documents/[id]/issue/route.ts` — server log prefix is now `[documents:issue] failed`; 500 responses now also include `detail` so the underlying error is visible during debugging. The existing 400 / 409 / 422 mappings (only-drafts / numbering-conflict / VALIDATION) are unchanged and still strip the machine-readable prefixes before sending the Hebrew message to the client.

### Test checklist

1. Apply the prior schema changes (`npx prisma generate && npx prisma db push`) if you have not yet — the issue flow doesn't need new schema, but the surrounding flows do.
2. Make sure the current business has `name` and `taxId` set in `/green/settings`. Without `taxId` the issue flow will (correctly) reject with `מספר עוסק / ח.פ חסר — עדכן בהגדרות העסק` — that is the expected message and confirms the wiring is right.
3. Go to `/green/documents/new`, fill the customer card (name + phone), add a line item, save the draft.
4. Open the newly created draft at `/green/documents/<id>`. Click `הנפק` and confirm.
5. Expect the toast "המסמך הונפק בהצלחה". The page refreshes and the document now shows status "הונפק" with a generated number (e.g. `INV-0001` or the configured prefix).
6. Verify in the DB: the row has `status = ISSUED`, `number` set, `issuedHash` set, and the snapshot fields (`customerName`, `customerEmail`, `customerAddress`, `customerTaxId`, `businessName`, `businessTaxId`, `businessAddress`) populated.
7. Verify the same customer row from the draft is still the only one for `(businessId, phone)` — issuing must not create a duplicate Customer.
8. Negative path: temporarily clear `business.taxId`, try to issue another draft, and confirm the inline button error shows the Hebrew validation message instead of the generic "שגיאה בהנפקה". Restore `taxId` afterwards.

## How to test on Vercel

1. Ensure Vercel environment variables are set for `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.
2. Deploy the branch.
3. Open `https://<your-domain>/green/login`.
4. Register a fresh account from the new `הרשמה` link and confirm the redirect back to `/green/login`.
5. Check the Supabase-backed `User` table to confirm the row was created and `passwordHash` is hashed.
6. Sign in with the same credentials at `/green/login` and confirm authentication still works in production under the `/green` base path.

## Slow page navigation — measure & optimize (`/documents`, `/documents/new`, `/settings`, `/dashboard`)

### Symptoms

Reported in production:

- `/green/documents` ≈ 7s
- `/green/documents/new` ≈ 5s
- `/green/settings` ≈ 9s

### Measured bottlenecks

After reading the loaders end-to-end:

1. **`/settings` issued the same `Business.findUnique` twice.** The page called `requireBusiness()` (which already returns the full `Business`) and then immediately called `getBusiness(session.id)` — `session` was actually the business object, so `session.id === businessId`. Two identical Postgres round-trips for the same row.
2. **`/dashboard` opened the JWT session twice.** It called `requireSession()` and `requireBusiness()` in parallel, but `requireBusiness()` itself calls `requireSession()` internally — so `getServerSession(authOptions)` ran twice, plus an extra `Business.findUnique` whose result the page never actually used (only `business.id` was read).
3. **`/documents` over-fetched customers.** The filter dropdown only renders `id`/`fullName`/`companyName`, but `listCustomers(businessId)` did `findMany` with no `select`, returning every column (`notes`, `address`, `taxId`, `createdAt`, `updatedAt`, …) for every active customer.
4. **`/documents/new` ran two queries serially.** `await requireBusiness()` (session decode + `Business.findUnique`) blocked `listSavedItems(business.id)` even though `savedItems` only needs the `businessId` (which is already on the JWT).

### Changes

#### New helpers

- `src/lib/perf.ts` — tiny `perf(label, fn)` wrapper that logs `[perf] <label> <ms>ms` after the wrapped promise settles. Covers the loggers the spec asked for (`[perf] documents load total`, `[perf] settings load total`, `[perf] prisma query X`, …) without dragging in any tracing dep.
- `src/services/auth.service.ts` — added `requireBusinessId()`, which returns `{ user, businessId }` from the JWT *without* a `Business.findUnique`. Pages that only need `businessId` (most of them) now use this and parallelise the actual data fetches. `requireBusiness()` is preserved for routes that genuinely need the full `Business` row (e.g. `/api/documents/[id]/issue`).
- `src/services/customer.service.ts` — added `listCustomersForFilter(businessId)`, a slim `select`-only variant returning just `{ id, fullName, companyName }` for dropdown options. The original `listCustomers` is unchanged so the customers list page (which needs `phone`/`email`/`taxId`) is not affected.

#### Page loaders

- `src/app/(dashboard)/settings/page.tsx`
  - Drops the duplicate `Business.findUnique`. Now: `requireBusinessId()` → `Promise.all([getBusiness(businessId), listSavedItems(businessId)])`.
- `src/app/(dashboard)/documents/page.tsx`
  - Switched to `requireBusinessId()` (no extra `Business.findUnique`).
  - `listCustomers` → `listCustomersForFilter` for the dropdown.
- `src/app/(dashboard)/documents/new/page.tsx`
  - `requireBusinessId()` then `Promise.all([getBusiness(businessId), listSavedItems(businessId)])`. Previously the two queries ran in series.
- `src/app/(dashboard)/dashboard/page.tsx`
  - Single `getServerSession` via `requireBusinessId()`. The redundant `Business.findUnique` is gone — `getDashboardData(businessId)` already returns everything the page renders.

#### Visible loading states (Next.js `loading.tsx`)

The first paint of these routes was blocked on the entire server-side data fetch, so users saw a frozen tab during navigation. Added skeletons so the route transition is immediate:

- `src/app/(dashboard)/documents/loading.tsx`
- `src/app/(dashboard)/documents/new/loading.tsx`
- `src/app/(dashboard)/settings/loading.tsx`

(`src/app/(dashboard)/loading.tsx` already existed as a fallback.)

#### Timing logs

Wrapped the hot Prisma calls so prod logs show where the time is going. Logs use the format the spec asked for:

- `[perf] documents load total <ms>ms`
- `[perf] documents/new load total <ms>ms`
- `[perf] settings load total <ms>ms`
- `[perf] dashboard load total <ms>ms`
- `[perf] dashboard.getDashboardData (7 queries) <ms>ms`
- `[perf] document.listDocuments <ms>ms`
- `[perf] customer.listCustomersForFilter <ms>ms`
- `[perf] savedItem.listSavedItems <ms>ms`
- `[perf] business.getBusiness <ms>ms`
- `[perf] auth.requireBusiness business.findUnique <ms>ms`

### Files changed

- `src/lib/perf.ts` (new)
- `src/services/auth.service.ts` (new `requireBusinessId`; `requireBusiness` instrumented)
- `src/services/business.service.ts` (instrumented)
- `src/services/customer.service.ts` (new `listCustomersForFilter`; instrumented)
- `src/services/document.service.ts` (`listDocuments` instrumented)
- `src/services/dashboard.service.ts` (parallel batch instrumented)
- `src/services/savedItem.service.ts` (`listSavedItems` instrumented)
- `src/app/(dashboard)/dashboard/page.tsx` (single session; no extra `Business` fetch)
- `src/app/(dashboard)/documents/page.tsx` (slim filter customers; `requireBusinessId`)
- `src/app/(dashboard)/documents/new/page.tsx` (parallel `business` + `savedItems`)
- `src/app/(dashboard)/settings/page.tsx` (drop duplicate `Business.findUnique`)
- `src/app/(dashboard)/documents/loading.tsx` (new)
- `src/app/(dashboard)/documents/new/loading.tsx` (new)
- `src/app/(dashboard)/settings/loading.tsx` (new)
- `docs/RUNNING_SUMMARY.md`

### Queries optimised (per page)

| Route | Before | After |
| --- | --- | --- |
| `/settings` | `getServerSession` + `Business.findUnique` (auth) + `Business.findUnique` (page) + `SavedItem.findMany` — 1 session, 3 DB hits, partly serial | `getServerSession` + `Business.findUnique` ‖ `SavedItem.findMany` — 1 session, 2 DB hits, fully parallel |
| `/documents` | `getServerSession` + `Business.findUnique` (auth) + `Document.findMany` (with `customer` select) ‖ `Customer.findMany` (every column) | `getServerSession` + `Document.findMany` ‖ `Customer.findMany` (`select: id/fullName/companyName`) — 1 fewer DB hit, much smaller customer payload |
| `/documents/new` | `getServerSession` + `Business.findUnique` → `SavedItem.findMany` (serial) | `getServerSession` + `Business.findUnique` ‖ `SavedItem.findMany` (parallel) |
| `/dashboard` | 2× `getServerSession` + `Business.findUnique` (whose result was unused) + `getDashboardData` (7 parallel queries) | 1× `getServerSession` + `getDashboardData` (7 parallel queries) — drops one full round-trip plus a duplicate session decode |

No Prisma schema changes. No business-logic changes. Auth is intact (`requireBusinessId` still throws on missing session / missing `businessId`).

### Before/after timing notes

Per-query and per-page timings are now visible in the server logs (look for `[perf]` lines) — the spec's "before" numbers came from production observation; the "after" should be measured on the same environment since local timings won't match prod DB latency. The structural wins are deterministic regardless of environment:

- `/settings`: −1 `Business.findUnique` (was duplicate), `getBusiness` and `listSavedItems` now overlap.
- `/dashboard`: −1 `getServerSession`, −1 unused `Business.findUnique`.
- `/documents`: customer payload reduced from full row to 3 columns; one `Business.findUnique` removed.
- `/documents/new`: `getBusiness` and `listSavedItems` overlap (was serial).
- All four routes now show a skeleton immediately on navigation instead of a blocked tab.

### Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds. The dynamic-server-usage warnings printed during `Generating static pages` are pre-existing and concern API routes that read `headers` for auth; they are correctly server-rendered (`ƒ` in the route table) and unrelated to this change.

### How to verify in prod

1. Deploy the branch.
2. Tail server logs while navigating to `/green/documents`, `/green/documents/new`, `/green/settings`, `/green/dashboard`.
3. For each route, confirm a `[perf] <route> load total <ms>ms` line appears, plus the per-query lines feeding into it. The page-total should be close to `max(parallel branches)` — if any single `[perf] prisma …` line is dominating, that is the next thing to attack (likely an index, not application code).
4. On a cold navigation the new `loading.tsx` skeleton should be visible immediately, replaced by the real UI when the loader finishes.

## Floating "+" quick-actions FAB

A mobile-first floating action button now sits on every dashboard page so the user can jump straight into a new document without going through the documents list first.

### Behaviour

- Circular `+` button, fixed at the bottom-end corner of the viewport (visually bottom-left under our `dir="rtl"` root via Tailwind's logical `end-*` utilities, bottom-right under LTR if the layout direction ever changes).
- Tap opens a bottom sheet on mobile, a centered card on `sm` and up. The sheet animates in (slide-up + fade backdrop, 200 ms ease-out) and animates back out on close.
- Closes on backdrop click, on the explicit `×` button, on `Esc`, and after any quick-action link is clicked.
- Body scroll is locked while the sheet is open and the previous `overflow` is restored on close.
- `aria-haspopup="dialog"` / `aria-expanded` on the FAB; the sheet is a `role="dialog"` `aria-modal="true"` with an `aria-labelledby` title.
- `env(safe-area-inset-bottom)` padding on both the FAB and the sheet to keep clear of the iOS home indicator.

### Sections + actions

- **מסמכי הכנסות** — הצעת מחיר → `/documents/new?type=quote`, חשבונית → `/documents/new?type=invoice`, קבלה → `/documents/new?type=receipt`.
- **מסמכי ניהול שוטף** — תעודת משלוח → `/documents/new?type=delivery`.

Next.js `Link` automatically prepends the `/green` `basePath`, so the rendered URLs are `/green/documents/new?type=…`.

### `?type=` preselect on `/documents/new`

`src/app/(dashboard)/documents/new/page.tsx` now reads `searchParams.type`, maps the lower-case slug to a `DocumentType` enum value (`quote → QUOTE`, `invoice → INVOICE`, `receipt → RECEIPT`, plus `invoice_receipt` and `credit_note` for completeness), and forwards it to `DocumentForm` as `defaultValues.type`. Unknown / missing values fall through to `DocumentForm`'s existing default (`INVOICE`) so behavior is unchanged for users who navigate to `/documents/new` directly.

> **Note on `delivery`** — the schema's `DocumentType` enum is `QUOTE | INVOICE | RECEIPT | INVOICE_RECEIPT | CREDIT_NOTE`. There is no delivery-note (`תעודת משלוח`) type today, so the `?type=delivery` link still lands on the new-document form but the form opens with the default `INVOICE` type selected — the menu entry is wired exactly as the spec requested, but adding a real delivery-note flow needs a schema/`DocumentType` change which is intentionally out of scope here.

### Files changed

- `src/components/layout/QuickActionsFab.tsx` (new — client component, Tailwind-only, no new deps)
- `src/app/(dashboard)/layout.tsx` (mounts `<QuickActionsFab />` once for every dashboard route)
- `src/app/(dashboard)/documents/new/page.tsx` (consumes `searchParams.type`, maps slug → enum)
- `docs/RUNNING_SUMMARY.md`

### Verification

- `npx tsc --noEmit` clean.
- `npm run build` succeeds; all dashboard routes still build, no new dependencies added.
- Manual smoke test plan:
  1. Visit `/green/dashboard`, `/green/documents`, `/green/settings` on mobile width — FAB visible bottom-left in each.
  2. Tap the FAB — sheet slides up, both section headings render (`מסמכי הכנסות`, `מסמכי ניהול שוטף`).
  3. Tap `הצעת מחיר` — navigates to `/green/documents/new?type=quote`, the form loads with `הצעת מחיר` preselected in the type dropdown.
  4. Repeat for `חשבונית` (`?type=invoice`), `קבלה` (`?type=receipt`).
  5. Tap `תעודת משלוח` — navigates to `/green/documents/new?type=delivery`, form opens with the default `חשבונית מס` type (no error).
  6. Tap the FAB → tap the dimmed backdrop → sheet closes; press `Esc` → sheet closes; reopen → tap the `×` → sheet closes.
  7. Confirm body scroll is locked while open and unlocked after close (try scrolling the page behind the sheet).
  8. Existing dashboard navigation (sidebar links, `+ מסמך חדש` button on `/documents`) still works unchanged.

## Quote (הצעת מחיר) PDF — premium redesign

`renderDocumentPdf` now branches on `document.type`. `QUOTE` documents render through a new `<QuotePage>` layout designed from scratch for a clean, premium feel; every other document type (`INVOICE`, `RECEIPT`, `INVOICE_RECEIPT`, `CREDIT_NOTE`) keeps the existing `<LegacyPage>` layout unchanged so invoices and receipts still look the way the business issued them historically.

This is presentation-only — pricing, totals, snapshot fields, hashing, and the issue/cancel flows are untouched.

### What the new quote layout looks like

- **Top accent bar** — full-bleed 6 pt brand-blue strip across the page edge. Single visual anchor; no heavy borders elsewhere.
- **Header (RTL-correct)**
  - Right (RTL primary): logo (when present), business name (18 pt bold), tax-id, address, phone, email — stacked, right-aligned, in muted slate.
  - Left: small `QUOTE` eyebrow, then the big 30 pt brand-blue **הצעת מחיר** title, then the document number in bold, the issue date, and *בתוקף עד* dueDate when set.
- **Hairline rule** under the header — a single 1 pt `#e2e8f0` line replaces the legacy heavy 1 pt slate-300 border.
- **Customer + event cards** — two side-by-side cards on a soft `#eef2ff` (brand-tint) background, 6 pt rounded corners, `פרטי לקוח` eyebrow on one, `פרטי האירוע` on the other. The event card is omitted entirely if no event fields are set.
  - Customer fields: שם לקוח · אימייל · טלפון (exactly the three the spec asked for; phone falls back to `customer.phone` since there is no snapshot for it).
  - Event fields: מיקום · תאריך · שעה.
- **Items list** — borderless layout with thin dividers between rows, 2 pt brand-blue underline on the column headers. Each row shows:
  - שם השירות (bold first line of `description`) + optional muted detail body for additional `description` lines.
  - כמות (centered).
  - מחיר (left-aligned, muted).
  - סה"כ (left-aligned, bold).
- **Totals** — right-aligned 260-pt block. Subtotal and VAT (with the actual rate %) are shown as muted rows; the final row is a brand-blue pill with white 16 pt bold **סה"כ לתשלום** + total. Hidden VAT row when `vatRateSnapshot` is 0 (e.g. `osek_patur`).
- **Notes** — only rendered when `document.notes` is non-empty after sanitisation. Sits under a hairline rule with its own eyebrow.
- **Footer** — fixed page footer with business name + page X / Y.

### Encoding fix — the "Ž=" smear

The reported `Ž=` artefact (and any similar garbled-glyph reports) traces back to invisible Bidi/zero-width control codepoints that get pasted into descriptions/names from web pages, Google Docs, or Office. Heebo can't render some of them and `@react-pdf/renderer` falls back to visible glyph stand-ins.

A new `sanitizeText(value)` helper at the top of `src/lib/pdf/document-pdf.tsx` strips the codepoint ranges below (codepoints listed by hex value to keep this doc free of the same hidden chars it's documenting):

- C0 controls `U+0000–U+0008`, `U+000B`, `U+000C`, `U+000E–U+001F` — `\t` (`U+0009`) and `\n` (`U+000A`) are preserved so multi-line item descriptions still split correctly
- DEL + C1 controls `U+007F–U+009F`
- Soft hyphen `U+00AD`
- Zero-width range + LRM/RLM `U+200B–U+200F`
- Explicit Bidi controls `U+202A–U+202E`
- Word-joiner family `U+2060–U+2064`
- Bidi isolate controls `U+2066–U+2069`
- BOM / ZWNBSP `U+FEFF`

`sanitizeText` is run on every user-supplied string in **both** the new quote layout *and* the legacy layout (business/customer fields, item descriptions, payment references, notes). The currency / date / percent / quantity formatters were already locked to `en-US`/`en-GB` to avoid Bidi marks; that remains unchanged. The `₪` glyph (`U+20AA`) is in Heebo's character set and continues to render correctly.

### RTL correctness

`@react-pdf/renderer` does not honour `direction: "rtl"` at the page level — every visual ordering must come from `flexDirection: "row-reverse"` and `textAlign: "right"`. The new quote layout follows that throughout: the header `headerRight` truly is the visual right under RTL because of `row-reverse`; card rows reverse the same way; item rows place the description on the right; totals are anchored to the right via `justifyContent: "flex-start"` on a `row-reverse` wrapper.

### Files changed

- `src/lib/pdf/document-pdf.tsx`
  - new `sanitizeText` / `safeOrDash` / `splitDescription` helpers
  - new `quote` `StyleSheet` (premium design tokens)
  - new `QuotePage` component
  - existing layout extracted to a `LegacyPage` component
  - `PdfTemplate` now branches on `document.type === "QUOTE"`
  - sanitisation applied to user-supplied strings in the legacy layout too
- `docs/RUNNING_SUMMARY.md`

### Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — clean.
- `npm test` — 43/43 passing (no PDF-renderer tests existed; service tests still green).
- Manual smoke test plan:
  1. Issue a `QUOTE` (`הצעת מחיר`) draft with: customer (name + email + phone), `eventLocation` / `eventDate` / `eventTime` filled in, two items where the second item's `description` has multiple lines, a non-zero VAT rate, and a `notes` body. Issue it, then `GET /api/documents/<id>/pdf` — confirm the new layout: brand bar at top, big title on the left, business + logo on the right, two soft-blue cards, items list with bold first line + muted body for the multi-line item, brand-pill final total, notes block.
  2. Issue a `QUOTE` with no event fields and a single short-description item — confirm the event card disappears entirely and the items list still renders cleanly.
  3. Issue a `QUOTE` for an `osek_patur` business (vat = 0) — confirm the VAT row is hidden in the totals and the final pill still shows the correct total.
  4. Paste a description with hidden Bidi marks (e.g. copy from a Hebrew web page) — confirm the rendered PDF shows clean text with no `Ž=` / boxes / extra whitespace.
  5. Issue a `RECEIPT` and an `INVOICE` — confirm those still render through the legacy layout and look exactly as before this change.
  6. Confirm Hebrew RTL ordering everywhere (cards, item rows, totals, footer).

## Document email + WhatsApp delivery

Issued documents now trigger a delivery step only after a successful issue. The issue transaction and numbering logic are unchanged: the route issues first, audits second, and then starts email delivery in the background. If delivery fails, issuing still succeeds and the failure is logged with `console.error("[documents:email] failed", error)`.

### Email flow

- Shared delivery logic lives in `src/services/email.service.ts`.
- Automatic issue behavior:
  - always sends to `business.email`
  - also sends to the customer when `customer.email` exists (`document.customerEmail` snapshot first, fallback to `customer.email`)
- Manual customer resend behavior:
  - `POST /api/documents/[id]/send`
  - sends only to the customer
  - does not resend to the business owner
- Subject format:
  - `<סוג מסמך> חדשה מפוטופ - <number>`
  - example: `הצעת מחיר חדשה מפוטופ - QUO-0001`
- Premium email template:
  - polished RTL HTML email
  - business name and logo when available
  - document type + number
  - customer name
  - total amount
  - prominent CTA button: `צפייה / הורדת PDF`
  - business contact block
  - plain-text fallback included
- PDF attachment behavior:
  - the server tries to render and attach `<number>.pdf`
  - if PDF rendering fails, the email still sends and falls back to the secure public PDF link
- Customer-facing links:
  - emails no longer include dashboard/document-app routes
  - customer emails contain only the direct public PDF URL

### WhatsApp flow

- Issued document page actions now include:
  - `הורדת PDF`
  - `שליחה במייל`
  - `שליחה ב-WhatsApp`
- WhatsApp button behavior:
  - if `customer.phone` exists, opens `https://wa.me/<phone>?text=<encoded message>`
  - if no phone exists, copies the message to clipboard; if clipboard is unavailable, falls back to `navigator.share`
- WhatsApp message content:
  - greeting
  - document type + number
  - total amount
  - PDF link
- PDF is never auto-attached to WhatsApp
- Visual update:
  - replaced with a WhatsApp-style green button
  - includes inline WhatsApp icon
  - larger tap target for mobile

### PDF link

- Authenticated owner route remains:
  - `/green/api/documents/[id]/pdf`
- Added secure public token route for customer-facing sharing:
  - `/green/api/public/documents/[id]/pdf?token=...`
- Token behavior:
  - token is HMAC-signed from `document.id` + `issuedHash`
  - only issued documents with a valid token can be opened
  - invalid or missing tokens return `404`
- Result:
  - customers can open/download the PDF directly without logging in
  - other documents are not exposed

### Required env vars

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `NEXTAUTH_URL`

`NEXTAUTH_URL` is used to build absolute links for automatic issue-triggered emails when there is no request origin available.

### Verification

- Added tests:
  - `src/services/email.service.test.ts`
  - `src/lib/documents/delivery.test.ts`
- Covered by tests:
  - automatic issue delivery sends to the business email
  - customer email is added on issue when present
  - manual resend sends only to the customer
  - premium email output uses the public PDF CTA link
  - WhatsApp URL/message formatting is correct
  - public PDF link path stays under `/green`
- Mobile overflow fix:
  - issued-document action area now uses responsive grid/flex wrapping
  - buttons are full-width / stacked on mobile
  - min-height raised to 44px for tap targets
  - no sideways scrolling required for the action group
- Manual smoke test steps:
  1. Issue a draft from `/green/documents/[id]` and confirm issue still succeeds normally.
  2. Verify the business inbox always receives the automatic issue email.
  3. If the customer has an email, verify the customer also receives the automatic issue email.
  4. Click `שליחה במייל` and verify only the customer receives the resend.
  5. Open the customer email and confirm the CTA points to the signed public PDF route, not to `/green/documents/[id]`.
  6. Open the signed public PDF link in a logged-out browser and confirm the PDF opens successfully.
  7. Tamper with the token and confirm the public route returns `404`.
  8. On mobile width, confirm the action buttons stack/wrap without horizontal overflow and each button is easy to tap.
  9. Click `שליחה בוואטסאפ` with a phone and confirm the `wa.me` URL contains the expected message and public PDF link.
  10. Repeat without a phone and confirm clipboard/share fallback works.

## NEXTAUTH_SECRET server-only fix

The production crash came from a bad import boundary introduced by the signed public PDF work:

- `src/components/documents/DocumentShareActions.tsx` is a client component
- it imported `buildPublicDocumentPdfPath` from `src/lib/documents/public-pdf.ts`
- that module also read `process.env.NEXTAUTH_SECRET` and threw `NEXTAUTH_SECRET is not configured`

Because the client imported that shared helper, the secret-bearing module was pulled into the client graph and could fail during client rendering despite the env var existing correctly on Vercel.

### Fix

- `src/lib/documents/public-pdf.ts` is now explicitly server-only via `import "server-only"`
- secret access remains only in server code:
  - `src/lib/documents/public-pdf.ts`
  - `src/app/api/auth/login/route.ts`
- client-safe path building was moved to `src/lib/documents/delivery.ts`
  - `buildPublicDocumentPdfPath(documentId, token)` now only formats the URL and never touches env vars
- the signed token is now created on the server in:
  - `src/app/(dashboard)/documents/[id]/page.tsx`
  - `src/services/email.service.ts`
- the client component receives the already-generated `publicPdfToken` as plain data and only builds the URL string

### Logging

Added server-only logging for missing auth secret:

- `console.error("[auth] missing NEXTAUTH_SECRET")`

This exists only in server code and does not expose the secret to the client.

## Quote approval polish — 24h time, WhatsApp emojis, short links, compact UI

UX polish pass for the customer approval flow. Approval/security/token logic is
unchanged; pricing logic is unchanged. Visible changes only:

### 24-hour Israeli time input

- New `src/components/ui/Time24Input.tsx` — controlled hour/minute selects (00–23
  hours, 15-min minute steps with passthrough for any saved value) that always
  produce / consume an `HH:mm` string.
- `DocumentForm.tsx` event-time field now uses `Time24Input` instead of
  `<input type="time">`, so the picker never shows AM/PM regardless of the OS
  locale.
- Display sites continue to use `formatEventTime`, which already normalizes any
  legacy `9:00 AM` value to `09:00` and renders 24-hour form on the form, the
  approval page, the dashboard, and the PDF.

### Warmer WhatsApp approval message

`buildApprovalWhatsappMessage` (in `src/lib/documents/delivery.ts`) now uses the
new emoji template:

```
היי {{customerName}} 👋

שלחתי לך הצעת מחיר מפוטופ 📸

לצפייה בפרטי ההצעה ואישור התאריך:
{{approvalLink}}

לאחר האישור התאריך יישמר עבורך ✅

לכל שאלה אני כאן 🙂
```

The message still flows through `buildWhatsappShareUrl`, which already
URL-encodes the body and routes to `https://wa.me/<phone>?text=…` when a phone
is present, and `https://wa.me/?text=…` when not. Tests in
`delivery.test.ts` updated accordingly.

### Shorter, production-domain approval link

- `src/lib/documents/approval.ts`:
  - `getAppOrigin` now extracts the bare origin via `new URL(...).origin`,
    preferring `NEXTAUTH_URL`. This is robust to `NEXTAUTH_URL` values that
    already include the `/green` basePath (e.g. `https://liorsw.com/green`),
    avoiding the previous double-prefix risk and ignoring vercel preview
    hostnames in favor of the production domain.
  - Added `buildShortApprovalPath(rawToken)` which returns `/green/a/<token>`.
  - `buildApprovalUrl` now returns the short URL form
    `https://liorsw.com/green/a/<token>`.
- `src/app/a/[token]/page.tsx` — new alias route that re-exports the existing
  `src/app/approve/[token]/page.tsx` page (`default` and `dynamic`), so both
  `/green/a/<token>` and `/green/approve/<token>` continue to render the same
  approval page. Existing long-form links keep working.
- `src/lib/documents/delivery.ts`: removed unused `buildApprovalPagePath`.
  `buildAbsoluteUrl` now also uses `new URL(origin).origin` so it stays
  resilient to base URLs that include a path.
- `src/services/email.service.ts` now imports `buildApprovalUrl` directly so
  outgoing email links go through the same short-link + production-domain path.

### Compact business header on the approval page

`src/app/approve/[token]/page.tsx` — the top hero card was replaced with a
compact header showing only:

- business name
- `הצעת מחיר · {number}`
- `הופקה: {issueDate}`
- optional small contact line `{phone} · {email}`

Address, tax id, and the `BOUTIQUE PROPOSAL` block were removed.

### Simplified package price display on approval page

`src/app/approve/[token]/page.tsx` — each package card now shows a single
`סה"כ לחבילה` row instead of the previous `כמות / מחיר יחידה / סה"כ` triplet.
This is approval-page-only; PDF, dashboard, and stored item rows still keep
quantity and unit price.

### Files changed

- `src/components/ui/Time24Input.tsx` (new)
- `src/components/documents/DocumentForm.tsx`
- `src/lib/documents/delivery.ts`
- `src/lib/documents/delivery.test.ts`
- `src/lib/documents/approval.ts`
- `src/services/email.service.ts`
- `src/app/a/[token]/page.tsx` (new alias route)
- `src/app/approve/[token]/page.tsx`
- `docs/RUNNING_SUMMARY.md`

### Verification

- `npx tsc --noEmit` — clean
- `npm run build` — succeeds; route table now shows both `/a/[token]` and
  `/approve/[token]` as dynamic server-rendered pages.

## WhatsApp emoji root cause + post-approval actions

### Real cause of "emojis show as �"

There was no encoding bug in the source — the bytes were correct UTF-8 in
`delivery.ts` and the compiled chunk (e.g. `👋` for 👋, literal `✅`).
Audit of the share path:

- `src/components/documents/DocumentShareActions.tsx` has two share buttons:
  - `שליחה ב-WhatsApp` (the prominent green button) was wired to
    `buildWhatsappMessage`, which has **no emojis at all**.
  - `העתקת קישור אישור` was wired to `buildApprovalWhatsappMessage`, the new
    emoji message.
- The previous task only updated `buildApprovalWhatsappMessage`, so clicking
  the main green button on a quote sent the old plain-text message — no
  emojis ever appeared. The reported `�` was the user observing "emojis are
  missing" on the wrong code path. (No legacy escape helper, no double
  encoding.)

Fix: when `documentType === "QUOTE"` and an approval link is available,
`handleWhatsappShare` now builds the message with `buildApprovalWhatsappMessage`
so the emoji template is used regardless of which share button is clicked.
Plain `buildWhatsappMessage` is still used for non-quote documents.

Temporary client-side debug logs were added to both `handleWhatsappShare` and
`handleCopyApprovalLink` (and to the new approval-page WhatsApp button), so the
final `[whatsapp] message` and `[whatsapp] url` can be inspected in the browser
console to confirm production hits the new path:

```ts
console.log("[whatsapp] message", message);
console.log("[whatsapp] url", url);
```

No secrets are logged.

### Post-approval actions on the approval page

The success state inside `src/app/approve/[token]/ApprovalForm.tsx` previously
showed only a static "הצעת המחיר אושרה בהצלחה" card. It now renders two
visible actions immediately after approval:

1. **`שלח לי בוואטסאפ`** — opens WhatsApp pre-addressed to the business owner
   (`businessPhone` from business settings). Disabled with a small explanatory
   note when `businessPhone` is not configured. Message body uses
   `buildApprovedQuoteOwnerWhatsappMessage` (new helper in `delivery.ts`):

   ```
   הצעת מחיר אושרה ✅

   לקוח: {{customerName}}
   טלפון: {{customerPhone}}
   תאריך האירוע: {{eventDate}}
   שעה: {{eventTime}}
   סה"כ: {{total}}

   לצפייה בהצעה:
   {{approvalLink}}
   ```

   Optional fields are skipped when empty. The URL goes through the existing
   `buildWhatsappShareUrl`, so the message is `encodeURIComponent`-encoded
   exactly once. The button merely opens WhatsApp with prepared text — no
   automatic sending is performed or claimed.

2. **`שמור ביומן Google`** — opens
   `https://calendar.google.com/calendar/render?action=TEMPLATE` with:
   - `text` = `צילום אירוע - {{customerName}}`
   - `dates` = `start/end` derived from `eventDate` + `eventTime`, default
     duration 3 hours, with `ctz=Asia/Jerusalem`. When only `eventDate` is
     present, the URL falls back to an all-day event for that date.
   - `details` = customer name, customer phone, quote number, approval link.
   - `location` = `eventLocation` if available.

   When `eventDate` is missing, the calendar button is replaced with a small
   note (`שמירה ביומן זמינה כשתאריך האירוע מוגדר בהצעה`). All
   `URL.searchParams.set(...)` calls handle URI encoding internally — single
   encoding, no manual escaping.

### Data wiring

`src/app/approve/[token]/page.tsx` now passes the data the success view needs
into `ApprovalForm`:

- `businessPhone` (from `doc.business.phone`)
- `customerPhone` (from `doc.customer.phone`)
- `eventDateIso` (`doc.eventDate?.toISOString()`)
- `eventDateFormatted` (Hebrew-locale string for the WhatsApp body)
- `eventTime` (already normalized via `formatEventTime`)
- `eventLocation`
- `quoteNumber` (`doc.number`)
- `totalFormatted` (`formatCurrency(doc.totalAmount)`)
- `approvalLink` (built server-side via `buildApprovalUrl(token)` so the link
  always points at `https://liorsw.com/green/a/<token>` regardless of the
  hostname the customer reached the page through)

### Files changed

- `src/lib/documents/delivery.ts` — added
  `buildApprovedQuoteOwnerWhatsappMessage`.
- `src/components/documents/DocumentShareActions.tsx` — `handleWhatsappShare`
  now uses the emoji approval message for quotes; debug logs added.
- `src/app/approve/[token]/page.tsx` — passes the new props to `ApprovalForm`.
- `src/app/approve/[token]/ApprovalForm.tsx` — new `success` view with
  WhatsApp + Google Calendar buttons, plus calendar URL builder.
- `docs/RUNNING_SUMMARY.md`

### Verification

- `npx tsc --noEmit` — clean
- `npm run build` — succeeds; the new emoji template literal is present in
  the compiled chunk (`👋`, `📸`, `✅`, `🙂`).
- Jest: `delivery.test.ts` 7/7 passes.
- Manual smoke (still pending in production):
  1. Open an approval link, approve the quote with signature.
  2. The success card should now show the two action buttons.
  3. Click `שלח לי בוואטסאפ`; verify the opened wa.me URL targets the
     business phone and the decoded `text` param contains `הצעת מחיר אושרה ✅`
     plus the customer/event/total fields.
  4. Click `שמור ביומן Google`; verify the new event dialog opens with
     `צילום אירוע - {customer}` as title, the right date/time, and the
     details body.
  5. From the document page, click the green `שליחה ב-WhatsApp` button on a
     quote; the browser console should print `[whatsapp] message` containing
     the emoji template, and the URL should target wa.me with that emoji
     payload.
