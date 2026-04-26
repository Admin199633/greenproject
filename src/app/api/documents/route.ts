import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { saveDraftSchema } from "@/lib/validations/document";
import { createDraft } from "@/services/document.service";
import { auditDocumentCreate } from "@/services/audit.service";

export async function POST(req: Request) {
  try {
    const business = await requireBusiness();
    const body = await req.json();

    const parsed = saveDraftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const doc = await createDraft(business.id, parsed.data);
    auditDocumentCreate(doc, business.ownerUserId);
    return NextResponse.json({ id: doc.id }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/documents]", e);
    return NextResponse.json({ error: "שגיאה בשרת" }, { status: 500 });
  }
}
