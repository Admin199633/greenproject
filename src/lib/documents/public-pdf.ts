import { createHmac, timingSafeEqual } from "crypto";

const APP_BASE_PATH = "/green";

function getPublicPdfSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
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

export function buildPublicDocumentPdfPath(documentId: string, issuedHash: string) {
  const token = createPublicPdfToken(documentId, issuedHash);
  return `${APP_BASE_PATH}/api/public/documents/${documentId}/pdf?token=${token}`;
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
