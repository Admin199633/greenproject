# Running Summary

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
