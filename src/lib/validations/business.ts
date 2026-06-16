import { z } from "zod";

const optionalStr = (max: number, label: string) =>
  z.string().max(max, `${label} ארוך מדי`).optional().or(z.literal(""));

const startNumber = (label: string) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce
      .number()
      .int(`${label} חייב להיות מספר שלם`)
      .min(1, `${label} חייב להיות 1 ומעלה`)
      .max(2147483647, `${label} גדול מדי`)
      .optional()
      .default(1)
  );

export const businessSchema = z.object({
  name: z.string().min(1, "שם עסק חובה").max(200, "שם עסק ארוך מדי"),
  taxId: z.string().min(1, "מספר עוסק / ח.פ חובה").max(20, "מספר עוסק ארוך מדי"),
  address: optionalStr(500, "כתובת"),
  city: optionalStr(100, "עיר"),
  postalCode: optionalStr(20, "מיקוד"),
  country: optionalStr(100, "מדינה"),
  phone: optionalStr(30, "טלפון"),
  email: z
    .string()
    .email("כתובת אימייל לא תקינה")
    .optional()
    .or(z.literal("")),
  taxType: z
    .enum(["osek_murshe", "osek_patur", "chevra"])
    .optional()
    .default("osek_murshe"),
  businessType: z
    .enum(["general", "photography", "contractor", "consulting", "retail", "other"])
    .optional()
    .default("general"),
  vatRate: z.coerce
    .number()
    .min(0, "שיעור מע״מ לא יכול להיות שלילי")
    .max(100, "שיעור מע״מ לא תקין")
    .optional()
    .default(17),
  currency: optionalStr(10, "מטבע"),
  invoiceNumberPrefix: optionalStr(20, "קידומת חשבונית"),
  invoiceStartNumber: startNumber("מספר התחלתי לחשבונית"),
  receiptNumberPrefix: optionalStr(20, "קידומת קבלה"),
  receiptStartNumber: startNumber("מספר התחלתי לקבלה"),
  quoteNumberPrefix: optionalStr(20, "קידומת הצעת מחיר"),
  quoteStartNumber: startNumber("מספר התחלתי להצעת מחיר"),
  invoiceReceiptNumberPrefix: optionalStr(20, "קידומת חשבונית קבלה"),
  invoiceReceiptStartNumber: startNumber("מספר התחלתי לחשבונית קבלה"),
  sendIssueNotificationEmail: z.boolean().optional().default(false),
  quoteTermsText: z
    .string()
    .max(10000, "טקסט אותיות קטנות ארוך מדי")
    .optional()
    .or(z.literal("")),
  approvalWhatsappMessageTemplate: z
    .string()
    .max(10000, "תבנית הודעת וואטסאפ ארוכה מדי")
    .optional()
    .or(z.literal("")),
});

export type BusinessFormValues = z.infer<typeof businessSchema>;
