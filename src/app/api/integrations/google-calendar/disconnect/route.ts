import { NextResponse } from "next/server";
import { requireBusinessId } from "@/services/auth.service";
import { disconnectGoogleCalendar } from "@/services/google-calendar.service";

export async function POST() {
  try {
    const { businessId } = await requireBusinessId();
    await disconnectGoogleCalendar(businessId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[google-calendar] disconnect failed", err);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
