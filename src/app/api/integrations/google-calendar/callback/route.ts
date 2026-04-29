import { NextResponse } from "next/server";
import { handleOauthCallback } from "@/services/google-calendar.service";
import { verifyOauthState } from "@/lib/oauth-state";

const SETTINGS_PATH = "/green/settings";

function settingsRedirect(req: Request, params: Record<string, string>) {
  const url = new URL(SETTINGS_PATH, req.url);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  // Drop the host coming from the OAuth callback url (matches the request) so the
  // browser stays on the same origin.
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    return settingsRedirect(req, { calendar: "error", reason: error });
  }
  if (!code || !state) {
    return settingsRedirect(req, { calendar: "error", reason: "missing_params" });
  }

  const verified = verifyOauthState(state);
  if (!verified) {
    return settingsRedirect(req, { calendar: "error", reason: "invalid_state" });
  }

  try {
    await handleOauthCallback({ code, businessId: verified.businessId });
  } catch (err) {
    console.error("[google-calendar] oauth callback failed", err);
    return settingsRedirect(req, { calendar: "error", reason: "exchange_failed" });
  }

  return settingsRedirect(req, { calendar: "connected" });
}
