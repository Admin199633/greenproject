import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import {
  buildAbsoluteUrl,
  buildDocumentEmailBody,
  buildDocumentEmailSubject,
  buildDocumentPagePath,
  buildDocumentPdfPath,
} from "@/lib/documents/delivery";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { getDocumentById } from "@/services/document.service";

const SENDABLE_STATUSES = new Set(["ISSUED", "PARTIALLY_PAID", "PAID"]);

function buildFilename(number: string | null, id: string) {
  const base = (number ?? id).replace(/[^A-Za-z0-9_-]/g, "-");
  return `${base}.pdf`;
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

function getRecipientList(businessEmail: string | null | undefined, customerEmail: string | null | undefined) {
  const recipients = [businessEmail?.trim(), customerEmail?.trim()].filter(
    (value): value is string => Boolean(value)
  );

  return Array.from(new Set(recipients));
}

function getCustomerDisplayName(document: Awaited<ReturnType<typeof getDocumentById>>) {
  if (!document) return "לקוח";

  return (
    document.customerName ??
    document.customer.companyName ??
    document.customer.fullName ??
    "לקוח"
  );
}

export async function sendDocumentEmail(
  documentId: string,
  businessId: string,
  options?: { origin?: string | null }
): Promise<{ sent: boolean; to: string[]; attachedPdf: boolean }> {
  const document = await getDocumentById(documentId, businessId);

  if (!document) {
    throw new Error("Document not found");
  }

  if (!SENDABLE_STATUSES.has(document.status)) {
    throw new Error("Document must be issued before sending");
  }

  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  const recipients = getRecipientList(
    business.email,
    document.customerEmail ?? document.customer.email
  );

  if (!business.email?.trim()) {
    throw new Error("Business has no email address");
  }

  const transport = createTransport();
  const documentNumber = document.number ?? document.id;
  const documentUrl = buildAbsoluteUrl(
    buildDocumentPagePath(document.id),
    options?.origin
  );
  const pdfUrl = buildAbsoluteUrl(buildDocumentPdfPath(document.id), options?.origin);
  const subject = buildDocumentEmailSubject(document.type, documentNumber);
  const filename = buildFilename(document.number, document.id);

  let attachment:
    | {
        filename: string;
        content: Buffer;
        contentType: string;
      }
    | undefined;

  try {
    const pdfBuffer = await renderDocumentPdf({ business, document });
    attachment = {
      filename,
      content: Buffer.from(pdfBuffer),
      contentType: "application/pdf",
    };
  } catch (error) {
    console.error("[documents:email] pdf generation failed", error);
  }

  const fromAddress =
    process.env.SMTP_FROM?.trim() || business.email?.trim() || "noreply@example.com";

  await transport.sendMail({
    from: fromAddress,
    to: recipients,
    subject,
    text: buildDocumentEmailBody({
      customerName: getCustomerDisplayName(document),
      type: document.type,
      documentNumber,
      documentUrl,
      pdfUrl,
      hasAttachment: Boolean(attachment),
    }),
    attachments: attachment ? [attachment] : [],
  });

  return {
    sent: true,
    to: recipients,
    attachedPdf: Boolean(attachment),
  };
}
