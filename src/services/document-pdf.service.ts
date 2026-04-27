import { PAYMENT_METHODS } from "@/lib/validations/payment";

const PDF_ALLOWED_STATUSES = new Set(["ISSUED", "PARTIALLY_PAID", "PAID"]);

export function buildDocumentPdfFilename(number: string | null, id: string) {
  const safeBase = (number ?? id).replace(/[^A-Za-z0-9_-]/g, "-");
  return `${safeBase}.pdf`;
}

export function assertDocumentPdfAllowed(document: {
  status: string;
  type: string;
  payments: Array<{ method: string | null }>;
}) {
  if (document.status === "DRAFT") {
    throw new Error("DRAFT_PDF_NOT_ALLOWED");
  }

  if (document.status === "CANCELLED") {
    throw new Error("CANCELLED_PDF_NOT_ALLOWED");
  }

  if (!PDF_ALLOWED_STATUSES.has(document.status)) {
    throw new Error("PDF_NOT_ALLOWED");
  }

  const validPaymentMethodSet = new Set<string>(PAYMENT_METHODS);
  if (document.type === "RECEIPT" || document.type === "INVOICE_RECEIPT") {
    if (document.payments.length === 0) {
      throw new Error("RECEIPT_PAYMENT_REQUIRED");
    }

    const invalidMethod = document.payments.find(
      (payment) => !payment.method || !validPaymentMethodSet.has(payment.method)
    );
    if (invalidMethod) {
      throw new Error("RECEIPT_INVALID_PAYMENT_METHOD");
    }
  }
}
