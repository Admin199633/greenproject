import { NextResponse } from "next/server";
import { requireBusinessId } from "@/services/auth.service";
import {
  getConnectionStatus,
  getGoogleOauthEnv,
} from "@/services/google-calendar.service";

export async function GET() {
  try {
    const { businessId } = await requireBusinessId();
    const status = await getConnectionStatus(businessId);
    return NextResponse.json({
      ...status,
      configured: Boolean(getGoogleOauthEnv()),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
