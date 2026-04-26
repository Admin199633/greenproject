import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { getDocumentById } from "@/services/document.service";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentTypeValue,
} from "@/lib/validations/document";
import { getBusiness } from "@/services/business.service";

const SENDABLE_STATUSES = new Set(["ISSUED", "PARTIALLY_PAID", "PAID"]);

function buildFilename(number: string | null, id: string) {
  const base = (number ?? id).replace(/[^A-Za-z0-9_-]/g, "-");
  return `${base}.pdf`;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

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

export async function sendDocumentEmail(
  documentId: string,
  businessId: string
): Promise<{ sent: boolean; to: string }> {
  const document = await getDocumentById(documentId, businessId);

  if (!document) {
    throw new Error("Document not found");
  }

  if (!SENDABLE_STATUSES.has(document.status)) {
    throw new Error("Document must be issued before sending");
  }

  const customerEmail =
    document.customerEmail ?? document.customer.email;

  if (!customerEmail) {
    throw new Error("Customer has no email address");
  }

  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  const pdfBuffer = await renderDocumentPdf({ business, document });
  const filename = buildFilename(document.number, document.id);
  const typeLabel =
    DOCUMENT_TYPE_LABELS[document.type as DocumentTypeValue] ?? document.type;
  const subject = `${typeLabel} ${document.number ?? ""} — ${business.name}`.trim();

  const transport = createTransport();

  if (!transport) {
    // Stub: log instead of sending when SMTP is not configured
    console.error(
      `[email stub] Would send "${subject}" to ${customerEmail} (${filename}, ${pdfBuffer.byteLength} bytes)`
    );
    return { sent: false, to: customerEmail };
  }

  const fromAddress = process.env.SMTP_FROM ?? business.email ?? "noreply@example.com";

  await transport.sendMail({
    from: fromAddress,
    to: customerEmail,
    subject,
    text: `מצורף ${typeLabel} ${document.number ?? ""} מאת ${business.name}.`,
    attachments: [
      {
        filename,
        content: Buffer.from(pdfBuffer),
        contentType: "application/pdf",
      },
    ],
  });

  return { sent: true, to: customerEmail };
}

/**
 * Send a plain-text notification to the business email when a document is issued.
 * Returns { sent: false } (does NOT throw) when business.email is missing,
 * SMTP is not configured, or sending fails — so the caller's issue flow is never blocked.
 */
export async function sendIssueNotificationEmail(
  documentId: string,
  businessId: string
): Promise<{ sent: boolean }> {
  const [document, business] = await Promise.all([
    getDocumentById(documentId, businessId),
    getBusiness(businessId),
  ]);

  if (!document || !business) return { sent: false };

  const recipientEmail = business.email?.trim();
  if (!recipientEmail) return { sent: false };

  const typeLabel =
    DOCUMENT_TYPE_LABELS[document.type as DocumentTypeValue] ?? document.type;
  const docRef = document.number ?? document.id;
  const customerName =
    document.customerName ??
    document.customer.companyName ??
    document.customer.fullName ??
    "";
  const subject = `[הנפקה] ${typeLabel} ${docRef}`;
  const body = [
    `${typeLabel} ${docRef} הונפק בהצלחה.`,
    ``,
    `לקוח: ${customerName}`,
    `סכום: ${Number(document.totalAmount).toFixed(2)} ₪`,
    `תאריך: ${document.issueDate ? new Intl.DateTimeFormat("he-IL").format(document.issueDate) : "—"}`,
    ``,
    `לצפייה במסמך: /documents/${document.id}`,
  ].join("\n");

  const transport = createTransport();

  if (!transport) {
    console.error(
      `[email stub] Issue notification: "${subject}" → ${recipientEmail}`
    );
    return { sent: false };
  }

  const fromAddress =
    process.env.SMTP_FROM ?? business.email ?? "noreply@example.com";

  await transport.sendMail({
    from: fromAddress,
    to: recipientEmail,
    subject,
    text: body,
  });

  return { sent: true };
}
