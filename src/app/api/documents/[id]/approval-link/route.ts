import { NextResponse } from "next/server";
import { buildApprovalUrl } from "@/lib/documents/approval";
import { requireBusiness } from "@/services/auth.service";
import { mintQuoteApprovalToken } from "@/services/document.service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const { rawToken } = await mintQuoteApprovalToken(id, business.id);
    const approvalUrl = buildApprovalUrl(rawToken, new URL(req.url).origin);

    return NextResponse.json({ approvalUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";

    if (message === "Unauthorized") {
      return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    }
    if (message === "No business associated with this account") {
      return NextResponse.json({ error: "לא נמצא עסק" }, { status: 403 });
    }
    if (message === "Document not found") {
      return NextResponse.json({ error: "מסמך לא נמצא" }, { status: 404 });
    }
    if (message === "APPROVAL:Only quotes support customer approval") {
      return NextResponse.json(
        { error: "קישור אישור זמין רק להצעות מחיר" },
        { status: 400 }
      );
    }
    if (message === "APPROVAL:Only issued quotes can have an approval link") {
      return NextResponse.json(
        { error: "ניתן להפיק קישור אישור רק להצעת מחיר שהונפקה" },
        { status: 400 }
      );
    }
    if (message === "APPROVAL:Quote is already approved") {
      return NextResponse.json(
        { error: "הצעת המחיר כבר אושרה" },
        { status: 409 }
      );
    }

    console.error("[documents:approval-link] failed", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
