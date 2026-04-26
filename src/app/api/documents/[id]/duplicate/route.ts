import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { duplicateDocument } from "@/services/document.service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const draft = await duplicateDocument(id, business.id);

    return NextResponse.json({ id: draft.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";

    if (message === "Unauthorized") {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }
    if (message === "No business associated with this account") {
      return NextResponse.json({ error: "לא נמצא עסק לחשבון" }, { status: 403 });
    }
    if (message === "Document not found") {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    console.error("[POST /api/documents/:id/duplicate]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
