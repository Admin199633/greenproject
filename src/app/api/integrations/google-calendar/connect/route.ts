import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireBusinessId } from "@/services/auth.service";
import {
  buildGoogleAuthUrl,
  getGoogleOauthEnv,
} from "@/services/google-calendar.service";
import { signOauthState } from "@/lib/oauth-state";

export async function GET() {
  let businessId: string;
  try {
    ({ businessId } = await requireBusinessId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getGoogleOauthEnv()) {
    return NextResponse.json(
      {
        error:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI.",
      },
      { status: 500 }
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const state = signOauthState(businessId, nonce);
  const authUrl = buildGoogleAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
