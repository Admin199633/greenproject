import "server-only";
import { createHash, randomBytes } from "node:crypto";

const APP_BASE_PATH = "/green";
const FALLBACK_APP_URL = "https://liorsw.com";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getAppOrigin(origin?: string | null) {
  const candidates = [
    process.env.NEXTAUTH_URL?.trim(),
    origin?.trim(),
    FALLBACK_APP_URL,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      continue;
    }
  }
  return trimTrailingSlash(FALLBACK_APP_URL);
}

export function generateApprovalToken(): {
  rawToken: string;
  tokenHash: string;
} {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashApprovalToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashApprovalToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildApprovalPath(rawToken: string) {
  return `${APP_BASE_PATH}/approve/${encodeURIComponent(rawToken)}`;
}

export function buildShortApprovalPath(rawToken: string) {
  return `${APP_BASE_PATH}/a/${encodeURIComponent(rawToken)}`;
}

export function buildApprovalUrl(rawToken: string, origin?: string | null) {
  const base = getAppOrigin(origin);
  return `${base}${buildShortApprovalPath(rawToken)}`;
}
