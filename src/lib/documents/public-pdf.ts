import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

function getPublicPdfSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    console.error("[auth] missing NEXTAUTH_SECRET");
    throw new Error("NEXTAUTH_SECRET is not configured");
  }
  return secret;
}

function buildTokenPayload(documentId: string, issuedHash: string) {
  return `${documentId}:${issuedHash}`;
}

export function createPublicPdfToken(documentId: string, issuedHash: string) {
  return createHmac("sha256", getPublicPdfSecret())
    .update(buildTokenPayload(documentId, issuedHash))
    .digest("hex");
}

export function verifyPublicPdfToken(
  documentId: string,
  issuedHash: string,
  token: string
) {
  const expected = Buffer.from(createPublicPdfToken(documentId, issuedHash), "utf8");
  const actual = Buffer.from(token, "utf8");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
