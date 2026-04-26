import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { saveDraftSchema } from "@/lib/validations/document";
import {
  deleteDraft,
  getDocumentById,
  updateDraft,
} from "@/services/document.service";

type RouteCtx = { params: Promise<{ id: string }> };

/** Map service errors to HTTP status codes. */
function errorStatus(message: string): number {
  if (message.startsWith("IMMUTABLE:")) return 409;
  if (message.includes("Only drafts") || message.includes("Credit note")) return 400;
  if (message === "Document not found") return 404;
  return 500;
}

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const doc = await getDocumentById(id, business.id);

    if (!doc) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("[GET /api/documents/:id]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();

    // API-layer immutability guard — checked before parsing the body so the
    // client gets a 409 immediately without wasted validation work.
    const existing = await getDocumentById(id, business.id);
    if (!existing) {
      return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
    }
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: `לא ניתן לערוך מסמך בסטטוס ${existing.status}. עריכה מותרת רק לטיוטות.` },
        { status: 409 }
      );
    }

    const body = await req.json();
    const parsed = saveDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    await updateDraft(id, business.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    console.error("[PATCH /api/documents/:id]", error);
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();

    // API-layer immutability guard.
    const existing = await getDocumentById(id, business.id);
    if (!existing) {
      return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
    }
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: `לא ניתן למחוק מסמך בסטטוס ${existing.status}. מחיקה מותרת רק לטיוטות.` },
        { status: 409 }
      );
    }

    await deleteDraft(id, business.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    console.error("[DELETE /api/documents/:id]", error);
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
