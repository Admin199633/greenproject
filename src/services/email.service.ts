import { DocumentType } from "@prisma/client";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";
import {
  buildAbsoluteUrl,
  buildDocumentEmailHtml,
  buildDocumentEmailSubject,
  buildDocumentEmailText,
  buildPublicDocumentPdfPath,
  formatDocumentTotal,
} from "@/lib/documents/delivery";
import { buildApprovalUrl } from "@/lib/documents/approval";
import { createPublicPdfToken } from "@/lib/documents/public-pdf";
import { renderDocumentPdf } from "@/lib/pdf/document-pdf";
import {
  getDocumentById,
  mintQuoteApprovalToken,
} from "@/services/document.service";

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

export async function sendDocumentEmail(
  documentId: string,
  businessId: string,
  options?: {
    origin?: string | null;
    audience?: DeliveryAudience;
    /**
     * Raw approval token to include in the email body. Only relevant for QUOTE
     * documents. When omitted (or `null`), no approval link is added.
     */
    approvalRawToken?: string | null;
  }
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

  const businessEmail = business.email?.trim() || null;
  const customerEmail =
    document.customerEmail?.trim() || document.customer.email?.trim() || null;

  if (audience === "customer" && !customerEmail) {
    throw new Error("Customer has no email address");
  }

  const transport = createTransport();
  const documentNumber = document.number ?? document.id;
  const publicPdfToken = createPublicPdfToken(document.id, document.issuedHash);
  const pdfUrl = buildAbsoluteUrl(
    buildPublicDocumentPdfPath(document.id, publicPdfToken),
    options?.origin
  );
  let approvalRawToken = options?.approvalRawToken ?? null;
  if (
    document.type === DocumentType.QUOTE &&
    !document.approvedAt &&
    !approvalRawToken
  ) {
    try {
      const minted = await mintQuoteApprovalToken(document.id, businessId);
      approvalRawToken = minted.rawToken;
    } catch (error) {
      console.error("[documents:approval] mint failed", error);
    }
  }
  const approvalUrl =
    document.type === DocumentType.QUOTE && approvalRawToken
      ? buildApprovalUrl(approvalRawToken, options?.origin)
      : null;
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

  const customerDisplayName = getCustomerDisplayName(document);
  const textBody = buildDocumentEmailText({
    customerName: customerDisplayName,
    businessName: business.name,
    businessPhone: business.phone,
    businessEmail: business.email,
    type: document.type,
    documentNumber,
    totalAmount,
    pdfUrl,
    approvalUrl,
  });
  const htmlBody = buildDocumentEmailHtml({
    customerName: customerDisplayName,
    businessName: business.name,
    businessLogo: business.logo,
    businessPhone: business.phone,
    businessEmail: business.email,
    businessAddress: business.address,
    type: document.type,
    documentNumber,
    totalAmount,
    pdfUrl,
    approvalUrl,
  });

  async function deliverTo(transporter: Transporter, recipient: string) {
    await transporter.sendMail({
      from: fromAddress,
      to: [recipient],
      subject,
      text: textBody,
      html: htmlBody,
      attachments: attachment ? [attachment] : [],
    });
  }

  if (audience === "customer") {
    await deliverTo(transport, customerEmail!);
    return {
      sent: true,
      to: [customerEmail!],
      attachedPdf: Boolean(attachment),
    };
  }

  // audience === "issue": deliver an independent copy to the business (always,
  // for documentation) and to the customer (if a valid email exists). Each
  // send is isolated so a single failure cannot block the other recipient.
  const delivered: string[] = [];
  const failures: Array<{ recipient: string; error: unknown }> = [];

  if (businessEmail) {
    try {
      await deliverTo(transport, businessEmail);
      delivered.push(businessEmail);
    } catch (error) {
      console.error("[documents:email] business copy failed", error);
      failures.push({ recipient: businessEmail, error });
    }
  } else {
    console.warn(
      "[documents:email] business has no email configured — skipping documentation copy"
    );
  }

  if (customerEmail && customerEmail !== businessEmail) {
    try {
      await deliverTo(transport, customerEmail);
      delivered.push(customerEmail);
    } catch (error) {
      console.error("[documents:email] customer copy failed", error);
      failures.push({ recipient: customerEmail, error });
    }
  }

  if (delivered.length === 0) {
    const reason = failures.length > 0 ? failures[0].error : null;
    if (reason instanceof Error) throw reason;
    throw new Error("No document email recipients");
  }

  return {
    sent: true,
    to: delivered,
    attachedPdf: Boolean(attachment),
  };
}
