import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { listDocuments } from "@/services/document.service";
import { getDisplayName } from "@/services/customer.service";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  type DocumentStatusValue,
  type DocumentTypeValue,
} from "@/lib/validations/document";

function escapeCell(value: string | null | undefined): string {
  const str = value ?? "";
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const business = await requireBusiness();
    const { searchParams } = req.nextUrl;

    const documents = await listDocuments(business.id, {
      type: searchParams.get("type") ?? undefined,
      customerId: searchParams.get("customerId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      search: searchParams.get("q") ?? undefined,
    });

    const header = ["מספר", "לקוח", "סוג", "סטטוס", "תאריך", "סה״כ"].join(",");

    const rows = documents.map((doc) => {
      const typeLabel =
        DOCUMENT_TYPE_LABELS[doc.type as DocumentTypeValue] ?? doc.type;
      const statusLabel =
        DOCUMENT_STATUS_LABELS[doc.status as DocumentStatusValue] ?? doc.status;
      return [
        escapeCell(doc.number ?? ""),
        escapeCell(getDisplayName(doc.customer)),
        escapeCell(typeLabel),
        escapeCell(statusLabel),
        escapeCell(formatDate(doc.issueDate ?? doc.createdAt)),
        escapeCell(doc.totalAmount.toFixed(2)),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="documents.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }
    if (message === "No business associated with this account") {
      return NextResponse.json({ error: "לא נמצא עסק" }, { status: 403 });
    }
    console.error("[GET /api/documents/export]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
