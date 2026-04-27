import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { sendDocumentEmail } from "@/services/email.service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const origin = new URL(req.url).origin;
    const result = await sendDocumentEmail(id, business.id, { origin });

    return NextResponse.json(result, { status: 200 });
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
    if (message === "Document must be issued before sending") {
      return NextResponse.json(
        { error: "ניתן לשלוח רק מסמכים שהונפקו" },
        { status: 400 }
      );
    }
    if (message === "Business has no email address") {
      return NextResponse.json(
        { error: "לעסק אין כתובת אימייל" },
        { status: 400 }
      );
    }
    if (message === "SMTP is not configured") {
      return NextResponse.json(
        { error: "SMTP אינו מוגדר" },
        { status: 500 }
      );
    }

    console.error("[documents:email] failed", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
