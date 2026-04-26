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

## How to test on Vercel

1. Ensure Vercel environment variables are set for `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.
2. Deploy the branch.
3. Open `https://<your-domain>/green/login`.
4. Register a fresh account from the new `הרשמה` link and confirm the redirect back to `/green/login`.
5. Check the Supabase-backed `User` table to confirm the row was created and `passwordHash` is hashed.
6. Sign in with the same credentials at `/green/login` and confirm authentication still works in production under the `/green` base path.
