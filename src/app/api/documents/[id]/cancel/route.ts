import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { cancelDocument } from "@/services/document.service";
import { auditDocumentCancel } from "@/services/audit.service";

type RouteCtx = { params: Promise<{ id: string }> };

const CLIENT_ERRORS = [
  "Draft documents cannot be cancelled",
  "Partially paid documents cannot be cancelled",
  "Paid documents cannot be cancelled",
  "Document is already cancelled",
  "Only issued documents can be cancelled",
  "Documents with payments cannot be cancelled",
];

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const document = await cancelDocument(id, business.id);
    auditDocumentCancel(document, business.ownerUserId);

    return NextResponse.json({ id: document.id, status: document.status });
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

    console.error("[POST /api/documents/:id/cancel]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
