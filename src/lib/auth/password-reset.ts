import "server-only";
import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

const APP_BASE_PATH = "/green";
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const FALLBACK_APP_URL = "https://liorsw.com";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAppBaseUrl(origin?: string | null) {
  const candidate =
    origin?.trim() || process.env.NEXTAUTH_URL?.trim() || FALLBACK_APP_URL;
  return trimTrailingSlash(candidate);
}

export function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildResetUrl(rawToken: string, origin?: string | null) {
  const base = getAppBaseUrl(origin);
  return `${base}${APP_BASE_PATH}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

function createTransport() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    throw new Error("SMTP is not configured");
  }
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildEmailText(resetUrl: string) {
  return [
    "שלום,",
    "",
    "קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך.",
    "ניתן לאפס את הסיסמה דרך הקישור הבא:",
    resetUrl,
    "",
    "הקישור בתוקף ל-30 דקות בלבד.",
    "אם לא ביקשת לאפס את הסיסמה, אפשר להתעלם מהודעה זו.",
    "",
    "תודה,",
    "צוות פוטופ",
  ].join("\n");
}

function buildEmailHtml(resetUrl: string) {
  const safeUrl = escapeHtml(resetUrl);
  return `
<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>איפוס סיסמה</title>
  </head>
  <body style="margin:0;background:#f3f6fb;font-family:Arial,'Heebo',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background:#f3f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:32px;text-align:center;color:#ffffff;">
                <div style="font-size:14px;letter-spacing:0.08em;opacity:0.85;">Photop</div>
                <div style="font-size:26px;font-weight:700;line-height:1.3;margin-top:6px;">איפוס סיסמה</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <div style="font-size:18px;font-weight:700;margin-bottom:12px;">שלום,</div>
                <div style="font-size:16px;line-height:1.8;color:#334155;">
                  קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך.
                  לחיצה על הכפתור למטה תעביר אותך לדף שבו אפשר להגדיר סיסמה חדשה.
                </div>

                <div style="margin:28px 0;text-align:center;">
                  <a href="${safeUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 28px;border-radius:999px;">
                    איפוס סיסמה
                  </a>
                </div>

                <div style="font-size:14px;color:#475569;line-height:1.7;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;">
                  <div>הקישור בתוקף ל-<strong>30 דקות</strong> בלבד.</div>
                  <div style="margin-top:6px;">אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהודעה זו — הסיסמה הקיימת תישאר ללא שינוי.</div>
                </div>

                <div style="margin-top:24px;font-size:13px;color:#64748b;line-height:1.7;">
                  אם הכפתור אינו עובד, אפשר להעתיק את הקישור הבא לדפדפן:
                  <div style="margin-top:6px;word-break:break-all;direction:ltr;text-align:left;">${safeUrl}</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export async function sendPasswordResetEmail(params: {
  email: string;
  resetUrl: string;
}) {
  const transport = createTransport();
  const fromAddress =
    process.env.SMTP_FROM?.trim() || "noreply@example.com";

  await transport.sendMail({
    from: fromAddress,
    to: [params.email],
    subject: "איפוס סיסמה",
    text: buildEmailText(params.resetUrl),
    html: buildEmailHtml(params.resetUrl),
  });
}
