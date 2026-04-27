import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { perf } from "@/lib/perf";

/**
 * Returns the current session user, or throws if not authenticated.
 * Use in Server Components and Route Handlers.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

/**
 * Returns `{ user, businessId }` without an extra DB lookup for the business.
 * Use in pages that only need the businessId (most do) so we can run other
 * queries in parallel instead of waiting on a redundant `business.findUnique`.
 */
export async function requireBusinessId() {
  const user = await requireSession();
  if (!user.businessId) {
    throw new Error("No business associated with this account");
  }
  return { user, businessId: user.businessId };
}

/**
 * Returns the business owned by the current user, or throws if none found.
 */
export async function requireBusiness() {
  const { businessId } = await requireBusinessId();
  const business = await perf("auth.requireBusiness business.findUnique", () =>
    db.business.findUnique({ where: { id: businessId } })
  );
  if (!business) throw new Error("Business not found");
  return business;
}
