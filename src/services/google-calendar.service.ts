import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/encryption";

const GOOGLE_OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

export interface GoogleOauthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getGoogleOauthEnv(): GoogleOauthEnv | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildGoogleAuthUrl(state: string): string {
  const env = getGoogleOauthEnv();
  if (!env) {
    throw new Error("Google OAuth env vars are not configured");
  }
  const url = new URL(GOOGLE_OAUTH_AUTH_URL);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", REQUIRED_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const env = getGoogleOauthEnv();
  if (!env) {
    throw new Error("Google OAuth env vars are not configured");
  }
  const body = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const env = getGoogleOauthEnv();
  if (!env) {
    throw new Error("Google OAuth env vars are not configured");
  }
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

export async function handleOauthCallback(params: {
  code: string;
  businessId: string;
}): Promise<void> {
  const tokens = await exchangeCodeForTokens(params.code);
  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }

  const googleEmail = await fetchGoogleEmail(tokens.access_token);
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  const accessTokenEnc = encryptSecret(tokens.access_token);
  const refreshTokenEnc = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : null;

  await db.businessGoogleCalendarConnection.upsert({
    where: { businessId: params.businessId },
    create: {
      businessId: params.businessId,
      googleEmail,
      accessToken: accessTokenEnc,
      refreshToken: refreshTokenEnc,
      tokenExpiry: expiresAt,
    },
    update: {
      googleEmail,
      accessToken: accessTokenEnc,
      ...(refreshTokenEnc ? { refreshToken: refreshTokenEnc } : {}),
      tokenExpiry: expiresAt,
    },
  });
}

export async function disconnectGoogleCalendar(businessId: string): Promise<void> {
  await db.businessGoogleCalendarConnection.deleteMany({
    where: { businessId },
  });
}

export interface CalendarConnectionStatus {
  connected: boolean;
  googleEmail: string | null;
}

export async function getConnectionStatus(
  businessId: string
): Promise<CalendarConnectionStatus> {
  const conn = await db.businessGoogleCalendarConnection.findUnique({
    where: { businessId },
    select: { googleEmail: true },
  });
  if (!conn) return { connected: false, googleEmail: null };
  return { connected: true, googleEmail: conn.googleEmail };
}

async function getValidAccessToken(businessId: string): Promise<{
  accessToken: string;
  calendarId: string;
} | null> {
  const conn = await db.businessGoogleCalendarConnection.findUnique({
    where: { businessId },
  });
  if (!conn) return null;

  const expiry = conn.tokenExpiry ? conn.tokenExpiry.getTime() : 0;
  const now = Date.now();
  // Refresh 60s before expiry to be safe.
  if (expiry - now > 60_000) {
    return {
      accessToken: decryptSecret(conn.accessToken),
      calendarId: conn.calendarId,
    };
  }

  if (!conn.refreshToken) {
    // No refresh token — fall back to current access token if it still parses;
    // Google call will surface the 401 and we'll log it.
    return {
      accessToken: decryptSecret(conn.accessToken),
      calendarId: conn.calendarId,
    };
  }

  const refreshToken = decryptSecret(conn.refreshToken);
  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed.access_token) {
    throw new Error("Google refresh did not return access_token");
  }
  const newExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000)
    : null;
  await db.businessGoogleCalendarConnection.update({
    where: { businessId },
    data: {
      accessToken: encryptSecret(refreshed.access_token),
      tokenExpiry: newExpiresAt,
    },
  });
  return { accessToken: refreshed.access_token, calendarId: conn.calendarId };
}

export interface CreateCalendarEventInput {
  summary: string;
  description: string;
  location?: string | null;
  startISO: string;
  endISO: string;
  timeZone: string;
}

export interface CreateCalendarEventResult {
  eventId: string;
}

/**
 * Returns the created event id, or null if the business has no Google
 * Calendar connection. Throws on unexpected API failures.
 */
export async function createCalendarEventForBusiness(
  businessId: string,
  input: CreateCalendarEventInput
): Promise<CreateCalendarEventResult | null> {
  const tokenInfo = await getValidAccessToken(businessId);
  if (!tokenInfo) return null;

  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
    tokenInfo.calendarId
  )}/events`;

  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location ?? undefined,
    start: { dateTime: input.startISO, timeZone: input.timeZone },
    end: { dateTime: input.endISO, timeZone: input.timeZone },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenInfo.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar create event failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error("Google Calendar create event returned no id");
  }
  return { eventId: data.id };
}
