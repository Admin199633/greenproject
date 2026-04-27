import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { issueDraft } from "@/services/document.service";
import { sendDocumentEmail } from "@/services/email.service";
import { auditDocumentIssue } from "@/services/audit.service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const session = await requireBusiness();
    const doc = await issueDraft(id, session.id);
    auditDocumentIssue(doc, session.ownerUserId);

    void sendDocumentEmail(doc.id, session.id, { audience: "issue" }).catch((error) => {
      console.error("[documents:email] failed", error);
    });

    return NextResponse.json({ id: doc.id, number: doc.number });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "שגיאה בשרת";
    const status = raw.includes("Only drafts")
      ? 400
      : raw.startsWith("NUMBERING_CONFLICT:")
      ? 409
      : raw.startsWith("VALIDATION:")
      ? 422
      : 500;
    const clientMsg = raw.startsWith("VALIDATION:")
      ? raw.slice("VALIDATION:".length)
      : raw.startsWith("NUMBERING_CONFLICT:")
      ? "מספור כפול - נסה שנית"
      : raw;
    console.error("[documents:issue] failed", e);
    const detail = e instanceof Error ? e.message : "";
    return NextResponse.json(
      status === 500 ? { error: clientMsg, detail } : { error: clientMsg },
      { status }
    );
  }
}
