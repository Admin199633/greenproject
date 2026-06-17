import { NextResponse } from "next/server";
import { requireSession } from "@/services/auth.service";
import { deletePayment } from "@/services/payment.service";
import { auditPaymentDelete } from "@/services/audit.service";

type RouteCtx = { params: Promise<{ id: string }> };

const CLIENT_ERRORS: Record<string, { status: number; error: string }> = {
  "Payment not found": { status: 404, error: "תשלום לא נמצא" },
  "Cannot delete payment from a cancelled document": {
    status: 409,
    error: "לא ניתן למחוק תשלום ממסמך מבוטל",
  },
};

export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const user = await requireSession();
    if (!user.businessId) {
      return NextResponse.json({ error: "No business" }, { status: 403 });
    }

    const payment = await deletePayment(id, user.businessId);
    auditPaymentDelete(
      { ...payment, amount: String(payment.amount) },
      user.id
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה בשרת";

    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    const clientError = CLIENT_ERRORS[msg];
    if (clientError) {
      return NextResponse.json(
        { error: clientError.error },
        { status: clientError.status }
      );
    }

    console.error("[DELETE /api/payments/:id]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
