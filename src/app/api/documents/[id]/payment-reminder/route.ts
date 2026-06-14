import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { sendPaymentReminderEmail } from "@/services/email.service";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const result = await sendPaymentReminderEmail(id, business.id);
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
    if (message === "Customer has no email address") {
      return NextResponse.json(
        { error: "ללקוח אין כתובת אימייל" },
        { status: 400 }
      );
    }

    console.error("[documents:reminder] failed", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
