import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { verifyPublicPdfToken } from "@/lib/documents/public-pdf";
import {
  assertDocumentPdfAllowed,
  buildDocumentPdfFilename,
} from "@/services/document-pdf.service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const token = new URL(req.url).searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const document = await db.document.findFirst({
      where: {
        id,
        status: { not: "DELETED" },
      },
      include: {
        business: {
          select: {
            name: true,
            taxId: true,
            address: true,
            logo: true,
            phone: true,
            email: true,
          },
        },
        customer: true,
        sourceDocument: {
          select: { id: true, number: true, type: true, status: true },
        },
        creditNote: {
          select: { id: true, number: true, type: true, status: true },
        },
        items: { orderBy: { lineIndex: "asc" } },
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });

    if (!document?.issuedHash) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    if (!verifyPublicPdfToken(document.id, document.issuedHash, token)) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    try {
      assertDocumentPdfAllowed(document);
    } catch {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const filename = buildDocumentPdfFilename(document.number, document.id);
    const pdfBuffer = await renderDocumentPdf({
      business: document.business,
      document,
    });

    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[GET /api/public/documents/:id/pdf]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
