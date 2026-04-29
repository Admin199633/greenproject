import { DOCUMENT_TYPE_LABELS, type DocumentTypeValue } from "@/lib/validations/document";

const APP_BASE_PATH = "/green";

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

function formatCurrencyForDocument(amount: string, currency: string) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

export function getDocumentTypeLabel(type: string) {
  return DOCUMENT_TYPE_LABELS[type as DocumentTypeValue] ?? type;
}

export function buildDocumentPagePath(documentId: string) {
  return `${APP_BASE_PATH}/documents/${documentId}`;
}

export function buildDocumentPdfPath(documentId: string) {
  return `${APP_BASE_PATH}/api/documents/${documentId}/pdf`;
}

export function buildPublicDocumentPdfPath(documentId: string, token: string) {
  return `${APP_BASE_PATH}/api/public/documents/${documentId}/pdf?token=${encodeURIComponent(token)}`;
}

export function buildAbsoluteUrl(path: string, origin?: string | null) {
  const candidate = origin?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!candidate) {
    return path;
  }

  try {
    return `${new URL(candidate).origin}${path}`;
  } catch {
    return `${trimTrailingSlash(candidate)}${path}`;
  }
}

export function buildDocumentEmailSubject(type: string, documentNumber: string) {
  return `${getDocumentTypeLabel(type)} חדשה מפוטופ - ${documentNumber}`;
}

export function buildDocumentEmailText(params: {
  customerName: string;
  businessName: string;
  businessPhone?: string | null;
  businessEmail?: string | null;
  type: string;
  documentNumber: string;
  totalAmount: string;
  pdfUrl: string;
  approvalUrl?: string | null;
}) {
  const lines = [
    `שלום ${params.customerName},`,
    "",
    `מצורפת ${getDocumentTypeLabel(params.type)} מספר ${params.documentNumber}.`,
    `סכום המסמך: ${params.totalAmount}`,
    "",
    "לצפייה או להורדת ה-PDF:",
    params.pdfUrl,
  ];

  if (params.approvalUrl) {
    lines.push(
      "",
      "לאישור הצעת המחיר באופן מקוון:",
      params.approvalUrl
    );
  }

  lines.push(
    "",
    "לשאלות נוספות נשמח לעמוד לרשותך.",
    params.businessName
  );

  if (params.businessPhone) {
    lines.push(`טלפון: ${params.businessPhone}`);
  }
  if (params.businessEmail) {
    lines.push(`אימייל: ${params.businessEmail}`);
  }

  return lines.join("\n");
}

export function buildDocumentEmailHtml(params: {
  customerName: string;
  businessName: string;
  businessLogo?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  businessAddress?: string | null;
  type: string;
  documentNumber: string;
  totalAmount: string;
  pdfUrl: string;
  approvalUrl?: string | null;
}) {
  const customerName = escapeHtml(params.customerName);
  const businessName = escapeHtml(params.businessName);
  const typeLabel = escapeHtml(getDocumentTypeLabel(params.type));
  const documentNumber = escapeHtml(params.documentNumber);
  const totalAmount = escapeHtml(params.totalAmount);
  const pdfUrl = escapeHtml(params.pdfUrl);
  const approvalUrl = params.approvalUrl ? escapeHtml(params.approvalUrl) : "";
  const logoMarkup = params.businessLogo
    ? `<img src="${escapeHtml(params.businessLogo)}" alt="${businessName}" style="display:block;max-width:96px;max-height:96px;border-radius:18px;margin:0 auto 16px auto;" />`
    : "";

  const approvalSectionMarkup = approvalUrl
    ? `
                <div style="margin:8px 0 28px;text-align:center;">
                  <a href="${approvalUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 28px;border-radius:999px;">
                    אישור הצעת המחיר באופן מקוון
                  </a>
                  <div style="margin-top:10px;font-size:13px;color:#64748b;line-height:1.6;">
                    אפשר לעיין בהצעה ולאשר אותה ישירות מהקישור — ללא צורך בהתחברות.
                  </div>
                </div>`
    : "";

  const contactLines = [
    params.businessPhone ? `טלפון: ${escapeHtml(params.businessPhone)}` : "",
    params.businessEmail ? `אימייל: ${escapeHtml(params.businessEmail)}` : "",
    params.businessAddress ? `כתובת: ${escapeHtml(params.businessAddress)}` : "",
  ]
    .filter(Boolean)
    .map((line) => `<div style="margin-top:6px;">${line}</div>`)
    .join("");

  return `
<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${typeLabel} ${documentNumber}</title>
  </head>
  <body style="margin:0;background:#f3f6fb;font-family:Arial,'Heebo',sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background:#f3f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:32px 32px 24px;text-align:center;color:#ffffff;">
                ${logoMarkup}
                <div style="font-size:14px;letter-spacing:0.08em;opacity:0.85;">Photop</div>
                <div style="font-size:30px;font-weight:700;line-height:1.2;margin-top:8px;">${businessName}</div>
                <div style="font-size:16px;line-height:1.6;margin-top:12px;">${typeLabel} מספר ${documentNumber}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <div style="font-size:18px;font-weight:700;margin-bottom:12px;">שלום ${customerName},</div>
                <div style="font-size:16px;line-height:1.8;color:#334155;">
                  מצורפת ${typeLabel} מספר <strong>${documentNumber}</strong>.
                  הכנו עבורך קישור ישיר לצפייה או להורדה של קובץ ה-PDF.
                </div>

                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="margin:24px 0 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <div style="font-size:13px;color:#64748b;">לקוח</div>
                      <div style="font-size:18px;font-weight:700;margin-top:4px;">${customerName}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 20px 18px;">
                      <div style="font-size:13px;color:#64748b;">סה"כ</div>
                      <div style="font-size:26px;font-weight:700;color:#0f766e;margin-top:4px;">${totalAmount}</div>
                    </td>
                  </tr>
                </table>

                <div style="margin:28px 0 16px;text-align:center;">
                  <a href="${pdfUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 28px;border-radius:999px;">
                    צפייה / הורדת PDF
                  </a>
                </div>${approvalSectionMarkup}

                <div style="font-size:15px;line-height:1.8;color:#475569;">
                  לשאלות נוספות נשמח לעמוד לרשותך.
                </div>

                <div style="margin-top:28px;padding-top:24px;border-top:1px solid #e2e8f0;font-size:14px;line-height:1.7;color:#475569;">
                  <div style="font-size:16px;font-weight:700;color:#0f172a;">${businessName}</div>
                  ${contactLines}
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

export function normalizeWhatsappPhone(phone: string) {
  const trimmed = phone.trim();
  const normalized = trimmed.replace(/[^\d+]/g, "");

  if (normalized.startsWith("+")) {
    return normalized.slice(1);
  }

  if (normalized.startsWith("00")) {
    return normalized.slice(2);
  }

  if (normalized.startsWith("0")) {
    return `972${normalized.slice(1)}`;
  }

  return normalized;
}

export function buildApprovalWhatsappMessage(params: {
  customerName: string;
  approvalUrl: string;
}) {
  return `היי ${params.customerName} 👋

שלחתי לך הצעת מחיר מפוטופ 📸

לצפייה בפרטי ההצעה ואישור התאריך:
${params.approvalUrl}

לאחר האישור התאריך יישמר עבורך ✅

לכל שאלה אני כאן 🙂`;
}

export function buildWhatsappMessage(params: {
  customerName: string;
  type: string;
  documentNumber: string;
  totalAmount: string;
  pdfUrl: string;
  approvalUrl?: string | null;
}) {
  const lines = [
    `שלום ${params.customerName},`,
    `${getDocumentTypeLabel(params.type)} מספר ${params.documentNumber}`,
    `סכום המסמך: ${params.totalAmount}`,
    `PDF: ${params.pdfUrl}`,
  ];

  if (params.approvalUrl) {
    lines.push(`אישור מקוון: ${params.approvalUrl}`);
  }

  return lines.join("\n");
}

export function buildApprovedQuoteOwnerWhatsappMessage(params: {
  customerName: string;
  customerPhone?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  total: string;
  approvalUrl: string;
}) {
  const lines: string[] = ["הצעת מחיר אושרה ✅", ""];
  lines.push(`לקוח: ${params.customerName}`);
  if (params.customerPhone?.trim()) {
    lines.push(`טלפון: ${params.customerPhone.trim()}`);
  }
  if (params.eventDate?.trim()) {
    lines.push(`תאריך האירוע: ${params.eventDate.trim()}`);
  }
  if (params.eventTime?.trim()) {
    lines.push(`שעה: ${params.eventTime.trim()}`);
  }
  lines.push(`סה"כ: ${params.total}`);
  lines.push("", "לצפייה בהצעה:", params.approvalUrl);
  return lines.join("\n");
}

export function buildOwnerApprovalRedirectWhatsappMessage(params: {
  customerName: string | null | undefined;
  customerPhone: string | null | undefined;
  eventDate: string | null | undefined;
  eventTime: string | null | undefined;
}) {
  const dash = "—";
  const customerName = params.customerName?.trim() || dash;
  const customerPhone = params.customerPhone?.trim() || dash;
  const eventDate = params.eventDate?.trim() || dash;
  const eventTime = params.eventTime?.trim() || dash;
  return [
    "הי ליאור",
    "הצעת מחיר אושרה ✅",
    "",
    `לקוח: ${customerName}`,
    `טלפון: ${customerPhone}`,
    `תאריך האירוע: ${eventDate}`,
    `שעה: ${eventTime}`,
  ].join("\n");
}

export function buildWhatsappShareUrl(phone: string, message: string) {
  const normalizedPhone = phone.trim() ? normalizeWhatsappPhone(phone) : "";
  const phonePath = normalizedPhone ? `/${normalizedPhone}` : "/";
  const encoded = encodeURIComponent(message);
  return `https://wa.me${phonePath}?text=${encoded}`;
}

export function formatDocumentTotal(amount: string, currency: string) {
  return formatCurrencyForDocument(amount, currency);
}
