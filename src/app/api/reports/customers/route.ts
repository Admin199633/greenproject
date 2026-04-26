import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const business = await requireBusiness();

    const customers = await db.customer.findMany({
      where: { businessId: business.id, isActive: true },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        documents: {
          where: {
            status: { notIn: ["DRAFT", "CANCELLED"] },
          },
          select: {
            totalAmount: true,
            amountPaid: true,
            amountDue: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const rows = customers.map((c) => {
      const totalBilled = c.documents.reduce(
        (sum, d) => sum.plus(d.totalAmount),
        new Prisma.Decimal(0)
      );
      const totalPaid = c.documents.reduce(
        (sum, d) => sum.plus(d.amountPaid),
        new Prisma.Decimal(0)
      );
      const openBalance = c.documents.reduce(
        (sum, d) => sum.plus(d.amountDue),
        new Prisma.Decimal(0)
      );

      return {
        id: c.id,
        fullName: c.fullName,
        companyName: c.companyName,
        documentsCount: c.documents.length,
        totalBilled: totalBilled.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        openBalance: openBalance.toFixed(2),
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }
    if (message === "No business associated with this account") {
      return NextResponse.json({ error: "לא נמצא עסק" }, { status: 403 });
    }
    console.error("[GET /api/reports/customers]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
