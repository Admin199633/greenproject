import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const business = await requireBusiness();

    const { searchParams } = req.nextUrl;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const method = searchParams.get("method");
    const customerId = searchParams.get("customerId");

    const payments = await db.payment.findMany({
      where: {
        businessId: business.id,
        ...(dateFrom || dateTo
          ? {
              paymentDate: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
        ...(method ? { method } : {}),
        ...(customerId ? { customerId } : {}),
      },
      select: {
        id: true,
        paymentDate: true,
        method: true,
        reference: true,
        amount: true,
        customer: {
          select: { id: true, fullName: true, companyName: true },
        },
        document: {
          select: { id: true, number: true, type: true },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    const rows = payments.map((p) => ({
      id: p.id,
      paymentDate: p.paymentDate,
      customer: p.customer,
      documentNumber: p.document.number,
      documentType: p.document.type,
      method: p.method,
      reference: p.reference,
      amount: p.amount.toFixed(2),
    }));

    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }
    if (message === "No business associated with this account") {
      return NextResponse.json({ error: "לא נמצא עסק" }, { status: 403 });
    }
    console.error("[GET /api/reports/payments]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
