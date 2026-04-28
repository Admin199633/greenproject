import { NextResponse } from "next/server";
import { DocumentType } from "@prisma/client";
import { requireBusiness } from "@/services/auth.service";
import {
  issueDraft,
  mintQuoteApprovalToken,
} from "@/services/document.service";
import { sendDocumentEmail } from "@/services/email.service";
import { auditDocumentIssue } from "@/services/audit.service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const session = await requireBusiness();
    const doc = await issueDraft(id, session.id, session.ownerUserId);
    auditDocumentIssue(doc, session.ownerUserId);

    let approvalRawToken: string | null = null;
    if (doc.type === DocumentType.QUOTE) {
      try {
        const minted = await mintQuoteApprovalToken(doc.id, session.id);
        approvalRawToken = minted.rawToken;
      } catch (error) {
        // Approval-token mint must never block issue. Log and continue.
        console.error("[documents:approval] mint failed", error);
      }
    }

    const origin = new URL(req.url).origin;
    void sendDocumentEmail(doc.id, session.id, {
      audience: "issue",
      origin,
      approvalRawToken,
    }).catch((error) => {
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
