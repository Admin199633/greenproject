import { NextResponse } from "next/server";
import { requireSession } from "@/services/auth.service";
import { createPaymentSchema } from "@/lib/validations/payment";
import { createPayment } from "@/services/payment.service";
import { auditPaymentAdd } from "@/services/audit.service";

export async function POST(req: Request) {
  try {
    const user = await requireSession();
    if (!user.businessId) {
      return NextResponse.json({ error: "No business" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const payment = await createPayment(user.businessId, user.id, parsed.data);
    auditPaymentAdd(
      { ...payment, amount: String(payment.amount) },
      user.id
    );
    return NextResponse.json({ id: payment.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה בשרת";
    const clientErrors = [
      "Cannot add payment",
      "Quotes cannot",
      "Credit notes cannot",
      "already fully paid",
      "exceeds remaining balance",
      "no outstanding balance",
      "Duplicate payment",
      "Only drafts can be issued",
    ];
    const status = clientErrors.some((s) => msg.includes(s)) ? 400 : 500;
    console.error("[POST /api/payments]", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
