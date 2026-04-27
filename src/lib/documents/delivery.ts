import { DOCUMENT_TYPE_LABELS, type DocumentTypeValue } from "@/lib/validations/document";

const APP_BASE_PATH = "/green";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
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

export function buildAbsoluteUrl(path: string, origin?: string | null) {
  const baseOrigin = origin?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!baseOrigin) {
    return path;
  }

  return `${trimTrailingSlash(baseOrigin)}${path}`;
}

export function buildDocumentEmailSubject(type: string, documentNumber: string) {
  return `${getDocumentTypeLabel(type)} חדשה מפוטופ - ${documentNumber}`;
}

export function buildDocumentEmailBody(params: {
  customerName: string;
  type: string;
  documentNumber: string;
  documentUrl: string;
  pdfUrl: string;
  hasAttachment: boolean;
}) {
  const lines = [
    `שלום ${params.customerName},`,
    `מצורפת ${getDocumentTypeLabel(params.type)} מספר ${params.documentNumber}`,
    "ניתן לצפות גם בקישור הבא:",
    params.documentUrl,
  ];

  if (!params.hasAttachment) {
    lines.push("", "להורדת PDF:", params.pdfUrl);
  }

  return lines.join("\n");
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

export function buildWhatsappMessage(params: {
  customerName: string;
  type: string;
  documentNumber: string;
  totalAmount: string;
  pdfUrl: string;
}) {
  return [
    `שלום ${params.customerName},`,
    `${getDocumentTypeLabel(params.type)} מספר ${params.documentNumber}`,
    `סכום לתשלום: ${params.totalAmount}`,
    `PDF: ${params.pdfUrl}`,
  ].join("\n");
}

export function buildWhatsappShareUrl(phone: string, message: string) {
  return `https://wa.me/${normalizeWhatsappPhone(phone)}?text=${encodeURIComponent(message)}`;
}
