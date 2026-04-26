import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { createCreditNoteFromDocument } from "@/services/document.service";

type RouteCtx = { params: Promise<{ id: string }> };

const CLIENT_ERRORS = [
  "Document type cannot be credited",
  "Only issued documents can create a credit note",
  "Credit note already exists for this document",
];

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const creditNote = await createCreditNoteFromDocument(id, business.id);

    return NextResponse.json({ id: creditNote.id }, { status: 201 });
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

    if (message === "Document not found") {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    const status = CLIENT_ERRORS.some((entry) => message.includes(entry)) ? 400 : 500;

    console.error("[POST /api/documents/:id/credit-note]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
