import { db } from "@/lib/db";
import { perf } from "@/lib/perf";
import type { BusinessFormValues } from "@/lib/validations/business";

export async function getBusiness(businessId: string) {
  return perf("business.getBusiness", () =>
    db.business.findUnique({ where: { id: businessId } })
  );
}

export async function updateBusiness(
  businessId: string,
  data: BusinessFormValues
) {
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
      invoiceNumberPrefix: data.invoiceNumberPrefix?.trim() || "INV-",
      receiptNumberPrefix: data.receiptNumberPrefix?.trim() || "REC-",
      quoteNumberPrefix: data.quoteNumberPrefix?.trim() || "QUO-",
      invoiceReceiptNumberPrefix:
        data.invoiceReceiptNumberPrefix?.trim() || "INVR-",
      sendIssueNotificationEmail: data.sendIssueNotificationEmail ?? false,
      quoteTermsText: data.quoteTermsText?.trim() || null,
    },
  });
}
