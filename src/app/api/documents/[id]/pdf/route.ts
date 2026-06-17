import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { getDocumentById } from "@/services/document.service";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import {
  assertDocumentPdfAllowed,
  buildDocumentPdfFilename,
} from "@/services/document-pdf.service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const document = await getDocumentById(id, business.id);

    if (!document) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    try {
      assertDocumentPdfAllowed(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF_NOT_ALLOWED";

      if (message === "DRAFT_PDF_NOT_ALLOWED") {
        return NextResponse.json(
          { error: "לא ניתן להפיק PDF לטיוטה" },
          { status: 400 }
        );
      }
      if (message === "RECEIPT_PAYMENT_REQUIRED") {
        return NextResponse.json(
          { error: "לא ניתן להפיק קבלה ללא תשלום רשום" },
          { status: 400 }
        );
      }
      if (message === "RECEIPT_INVALID_PAYMENT_METHOD") {
        return NextResponse.json(
          { error: "אמצעי תשלום חסר או לא תקין - לא ניתן להפיק קבלה" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "PDF זמין רק למסמכים שהונפקו" },
        { status: 400 }
      );
    }

    const filename = buildDocumentPdfFilename(document.number, document.id);
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
