import { NextResponse } from "next/server";
import { requireSession } from "@/services/auth.service";
import { deletePayment } from "@/services/payment.service";
import { auditPaymentDelete } from "@/services/audit.service";

type RouteCtx = { params: Promise<{ id: string }> };

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
    const status = msg.includes("not found") ? 404 : 500;
    console.error("[DELETE /api/payments/:id]", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
