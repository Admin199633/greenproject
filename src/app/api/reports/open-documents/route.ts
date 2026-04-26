import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const business = await requireBusiness();

    const documents = await db.document.findMany({
      where: {
        businessId: business.id,
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      },
      select: {
        id: true,
        number: true,
        issueDate: true,
        dueDate: true,
        totalAmount: true,
        amountPaid: true,
        amountDue: true,
        customer: {
          select: { id: true, fullName: true, companyName: true },
        },
      },
      orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
    });

    const rows = documents.map((doc) => ({
      id: doc.id,
      number: doc.number,
      issueDate: doc.issueDate,
      dueDate: doc.dueDate,
      customer: doc.customer,
      totalAmount: doc.totalAmount.toFixed(2),
      amountPaid: doc.amountPaid.toFixed(2),
      amountDue: doc.amountDue.toFixed(2),
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
    console.error("[GET /api/reports/open-documents]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
