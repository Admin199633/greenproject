import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { getCustomerDetail } from "@/services/customer.service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const { customer, recentDocuments, recentPayments, openAmount } =
      await getCustomerDetail(id, business.id);

    if (!customer) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    return NextResponse.json({
      customer,
      documents: recentDocuments,
      payments: recentPayments,
      openAmount: openAmount.toFixed(2),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }
    if (message === "No business associated with this account") {
      return NextResponse.json({ error: "לא נמצא עסק" }, { status: 403 });
    }
    console.error("[GET /api/customers/:id]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
