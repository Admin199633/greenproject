import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { getDocumentById } from "@/services/document.service";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { PAYMENT_METHODS } from "@/lib/validations/payment";

type RouteCtx = { params: Promise<{ id: string }> };

const PDF_ALLOWED_STATUSES = new Set(["ISSUED", "PARTIALLY_PAID", "PAID"]);

function buildFilename(number: string | null, id: string) {
  const safeBase = (number ?? id).replace(/[^A-Za-z0-9_-]/g, "-");
  return `${safeBase}.pdf`;
}

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const document = await getDocumentById(id, business.id);

    if (!document) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    if (document.status === "DRAFT") {
      return NextResponse.json(
        { error: "לא ניתן להפיק PDF לטיוטה" },
        { status: 400 }
      );
    }

    if (document.status === "CANCELLED") {
      return NextResponse.json(
        { error: "לא ניתן להפיק PDF למסמך מבוטל" },
        { status: 400 }
      );
    }

    if (!PDF_ALLOWED_STATUSES.has(document.status)) {
      return NextResponse.json(
        { error: "PDF זמין רק למסמכים שהונפקו" },
        { status: 400 }
      );
    }

    // ── Receipt / Invoice-Receipt compliance validation (Task 1.3) ──────────
    // A receipt is only legally valid if it records at least one payment with a
    // recognised payment method.
    const validPaymentMethodSet = new Set<string>(PAYMENT_METHODS);
    if (
      document.type === "RECEIPT" ||
      document.type === "INVOICE_RECEIPT"
    ) {
      if (document.payments.length === 0) {
        return NextResponse.json(
          { error: "לא ניתן להפיק קבלה ללא תשלום רשום" },
          { status: 400 }
        );
      }
      const invalidMethod = document.payments.find(
        (p) => !p.method || !validPaymentMethodSet.has(p.method)
      );
      if (invalidMethod) {
        return NextResponse.json(
          { error: "אמצעי תשלום חסר או לא תקין — לא ניתן להפיק קבלה" },
          { status: 400 }
        );
      }
    }

    const filename = buildFilename(document.number, document.id);
    const pdfBuffer = await renderDocumentPdf({
      business,
      document,
    });

    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";

    if (message === "Unauthorized") {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }

    if (message === "No business associated with this account") {
      return NextResponse.json(
        { error: "לא נמצא עסק לחשבון" },
        { status: 403 }
      );
    }

    console.error("[GET /api/documents/:id/pdf]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
