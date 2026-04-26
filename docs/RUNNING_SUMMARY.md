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

## How to test on Vercel

1. Ensure Vercel environment variables are set for `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.
2. Deploy the branch.
3. Open `https://<your-domain>/green/login`.
4. Register a fresh account from the new `הרשמה` link and confirm the redirect back to `/green/login`.
5. Check the Supabase-backed `User` table to confirm the row was created and `passwordHash` is hashed.
6. Sign in with the same credentials at `/green/login` and confirm authentication still works in production under the `/green` base path.
