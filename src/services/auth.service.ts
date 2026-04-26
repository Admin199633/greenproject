import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
 * Returns the business owned by the current user, or throws if none found.
 */
export async function requireBusiness() {
  const user = await requireSession();
  if (!user.businessId) {
    throw new Error("No business associated with this account");
  }
  const business = await db.business.findUnique({
    where: { id: user.businessId },
  });
  if (!business) throw new Error("Business not found");
  return business;
}
