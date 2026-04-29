import { createHmac } from "crypto";

/**
 * Tiny HMAC-signed OAuth state helper.
 *
 * Format: `<base64url(payload)>.<base64url(hmac)>`
 * Payload is JSON: `{ b: businessId, n: nonceHex, t: issuedAtMs }`
 *
 * The state binds the OAuth callback to the specific business that started it,
 * which prevents cross-account hijacking when the callback runs without an
 * authenticated session.
 */

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length < 8) {
    throw new Error("NEXTAUTH_SECRET is required to sign OAuth state");
  }
  return secret;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

export function signOauthState(businessId: string, nonceHex: string): string {
  const payload = JSON.stringify({ b: businessId, n: nonceHex, t: Date.now() });
  const payloadEnc = base64UrlEncode(payload);
  const sig = createHmac("sha256", getSecret()).update(payloadEnc).digest();
  return `${payloadEnc}.${base64UrlEncode(sig)}`;
}

export function verifyOauthState(
  state: string
): { businessId: string; nonce: string } | null {
  const dot = state.indexOf(".");
  if (dot <= 0) return null;
  const payloadEnc = state.slice(0, dot);
  const sigEnc = state.slice(dot + 1);
  const expected = createHmac("sha256", getSecret()).update(payloadEnc).digest();
  const got = base64UrlDecode(sigEnc);
  if (got.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected[i] ^ got[i];
  }
  if (diff !== 0) return null;
  let payload: { b?: string; n?: string; t?: number };
  try {
    payload = JSON.parse(base64UrlDecode(payloadEnc).toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.b || !payload.n || !payload.t) return null;
  if (Date.now() - payload.t > STATE_TTL_MS) return null;
  return { businessId: payload.b, nonce: payload.n };
}
