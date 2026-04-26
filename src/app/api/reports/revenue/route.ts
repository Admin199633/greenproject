import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

const REVENUE_TYPES = ["INVOICE", "INVOICE_RECEIPT"] as const;
const EXCLUDED_STATUSES = ["DRAFT", "CANCELLED"] as const;

export async function GET(req: NextRequest) {
  try {
    const business = await requireBusiness();

    const { searchParams } = req.nextUrl;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const documents = await db.document.findMany({
      where: {
        businessId: business.id,
        type: { in: [...REVENUE_TYPES] },
        status: { notIn: [...EXCLUDED_STATUSES] },
        ...(dateFrom || dateTo
          ? {
              issueDate: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
      select: {
        issueDate: true,
        subtotalAmount: true,
        taxAmount: true,
        totalAmount: true,
      },
      orderBy: { issueDate: "asc" },
    });

    // Group by YYYY-MM
    const byMonth = new Map<
      string,
      { count: number; subtotal: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal }
    >();

    for (const doc of documents) {
      const date = doc.issueDate ?? new Date(0);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const existing = byMonth.get(month);
      if (existing) {
        existing.count += 1;
        existing.subtotal = existing.subtotal.plus(doc.subtotalAmount);
        existing.tax = existing.tax.plus(doc.taxAmount);
        existing.total = existing.total.plus(doc.totalAmount);
      } else {
        byMonth.set(month, {
          count: 1,
          subtotal: new Prisma.Decimal(doc.subtotalAmount),
          tax: new Prisma.Decimal(doc.taxAmount),
          total: new Prisma.Decimal(doc.totalAmount),
        });
      }
    }

    const rows = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        count: data.count,
        subtotalAmount: data.subtotal.toFixed(2),
        taxAmount: data.tax.toFixed(2),
        totalAmount: data.total.toFixed(2),
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
    console.error("[GET /api/reports/revenue]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
