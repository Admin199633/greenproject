import { db } from "@/lib/db";
import { perf } from "@/lib/perf";
import {
  normalizeBusinessNumbering,
  type BusinessFormValues,
} from "@/lib/validations/business";

export async function getBusiness(businessId: string) {
  return perf("business.getBusiness", () =>
    db.business.findUnique({ where: { id: businessId } })
  );
}

export async function updateBusiness(
  businessId: string,
  data: BusinessFormValues
) {
  const numbering = normalizeBusinessNumbering(data);

  console.debug("[approval-template] service before prisma update", {
    businessId,
    approvalWhatsappMessageTemplate:
      data.approvalWhatsappMessageTemplate ?? null,
    hasReplacement:
      data.approvalWhatsappMessageTemplate?.includes("\uFFFD") ?? false,
  });
  return db.business.update({
    where: { id: businessId },
    data: {
      name: data.name.trim(),
      taxId: data.taxId?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      postalCode: data.postalCode?.trim() || null,
      country: data.country?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      taxType: data.taxType ?? "osek_murshe",
      businessType: data.businessType ?? "general",
      vatRate: data.vatRate ?? 17,
      currency: data.currency?.trim() || "ILS",
      invoiceNumberPrefix: numbering.invoiceNumberPrefix,
      invoiceStartNumber: numbering.invoiceStartNumber,
      receiptNumberPrefix: numbering.receiptNumberPrefix,
      receiptStartNumber: numbering.receiptStartNumber,
      quoteNumberPrefix: numbering.quoteNumberPrefix,
      quoteStartNumber: numbering.quoteStartNumber,
      invoiceReceiptNumberPrefix: numbering.invoiceReceiptNumberPrefix,
      invoiceReceiptStartNumber: numbering.invoiceReceiptStartNumber,
      sendIssueNotificationEmail: data.sendIssueNotificationEmail ?? false,
      quoteTermsText: data.quoteTermsText?.trim() || null,
      approvalWhatsappMessageTemplate:
        data.approvalWhatsappMessageTemplate?.trim() || null,
    },
  });
}
