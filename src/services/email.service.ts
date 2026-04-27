import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import {
  buildAbsoluteUrl,
  buildDocumentEmailHtml,
  buildDocumentEmailSubject,
  buildDocumentEmailText,
  formatDocumentTotal,
} from "@/lib/documents/delivery";
import { buildPublicDocumentPdfPath } from "@/lib/documents/public-pdf";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import { getDocumentById } from "@/services/document.service";

const SENDABLE_STATUSES = new Set(["ISSUED", "PARTIALLY_PAID", "PAID"]);

type DeliveryAudience = "issue" | "customer";

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

function getCustomerDisplayName(document: Awaited<ReturnType<typeof getDocumentById>>) {
  if (!document) return "לקוח";

  return (
    document.customerName ??
    document.customer.companyName ??
    document.customer.fullName ??
    "לקוח"
  );
}

function getRecipientList(params: {
  audience: DeliveryAudience;
  businessEmail: string | null | undefined;
  customerEmail: string | null | undefined;
}) {
  const businessEmail = params.businessEmail?.trim() || null;
  const customerEmail = params.customerEmail?.trim() || null;

  if (params.audience === "customer") {
    if (!customerEmail) {
      throw new Error("Customer has no email address");
    }
    return [customerEmail];
  }

  if (!businessEmail) {
    throw new Error("Business has no email address");
  }

  return Array.from(new Set([businessEmail, customerEmail].filter(Boolean) as string[]));
}

export async function sendDocumentEmail(
  documentId: string,
  businessId: string,
  options?: { origin?: string | null; audience?: DeliveryAudience }
): Promise<{ sent: boolean; to: string[]; attachedPdf: boolean }> {
  const audience = options?.audience ?? "issue";
  const document = await getDocumentById(documentId, businessId);

  if (!document) {
    throw new Error("Document not found");
  }

  if (!SENDABLE_STATUSES.has(document.status)) {
    throw new Error("Document must be issued before sending");
  }

  if (!document.issuedHash) {
    throw new Error("Document public PDF is unavailable");
  }

  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  const recipients = getRecipientList({
    audience,
    businessEmail: business.email,
    customerEmail: document.customerEmail ?? document.customer.email,
  });

  const transport = createTransport();
  const documentNumber = document.number ?? document.id;
  const pdfUrl = buildAbsoluteUrl(
    buildPublicDocumentPdfPath(document.id, document.issuedHash),
    options?.origin
  );
  const subject = buildDocumentEmailSubject(document.type, documentNumber);
  const filename = buildFilename(document.number, document.id);
  const totalAmount = formatDocumentTotal(
    document.totalAmount.toString(),
    document.currency
  );

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
    text: buildDocumentEmailText({
      customerName: getCustomerDisplayName(document),
      businessName: business.name,
      businessPhone: business.phone,
      businessEmail: business.email,
      type: document.type,
      documentNumber,
      totalAmount,
      pdfUrl,
    }),
    html: buildDocumentEmailHtml({
      customerName: getCustomerDisplayName(document),
      businessName: business.name,
      businessLogo: business.logo,
      businessPhone: business.phone,
      businessEmail: business.email,
      businessAddress: business.address,
      type: document.type,
      documentNumber,
      totalAmount,
      pdfUrl,
    }),
    attachments: attachment ? [attachment] : [],
  });

  return {
    sent: true,
    to: recipients,
    attachedPdf: Boolean(attachment),
  };
}
