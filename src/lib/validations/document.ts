import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/validations/payment";

export const DOCUMENT_TYPES = [
  "QUOTE",
  "INVOICE",
  "RECEIPT",
  "INVOICE_RECEIPT",
  "CREDIT_NOTE",
] as const;

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number];
export type DocumentStatusValue = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentTypeValue, string> = {
  QUOTE: "הצעת מחיר",
  INVOICE: "חשבונית מס",
  RECEIPT: "קבלה",
  INVOICE_RECEIPT: "חשבונית מס / קבלה",
  CREDIT_NOTE: "זיכוי",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatusValue, string> = {
  DRAFT: "טיוטה",
  ISSUED: "הונפק",
  PARTIALLY_PAID: "שולם חלקית",
  PAID: "שולם",
  CANCELLED: "בוטל",
};

const moneyStr = z.string().regex(/^-?\d+(\.\d{1,2})?$/, "סכום לא תקין");
const posMoneyStr = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "סכום חייב להיות אפס או חיובי");
const qtyStr = z.string().regex(/^\d+(\.\d{1,3})?$/, "כמות לא תקינה");

export const documentItemSchema = z.object({
  lineIndex: z.number().int().min(0),
  description: z.string().min(1, "תיאור הפריט חובה").max(500),
  quantity: qtyStr,
  unitPrice: posMoneyStr,
  discountAmount: posMoneyStr,
  subtotalAmount: moneyStr,
  taxRate: posMoneyStr,
  taxAmount: posMoneyStr,
  totalAmount: moneyStr,
});

const paymentMethodSchema = z.enum(PAYMENT_METHODS, {
  errorMap: () => ({ message: "אמצעי תשלום לא תקין" }),
});

const baseSaveDraftSchema = z.object({
  type: z.enum(DOCUMENT_TYPES, {
    errorMap: () => ({ message: "סוג מסמך לא תקין" }),
  }),
  customerName: z.string().trim().min(1, "שם לקוח חובה").max(200, "שם לקוח ארוך מדי"),
  customerPhone: z.string().trim().min(1, "מספר טלפון חובה").max(30, "מספר טלפון ארוך מדי"),
  customerEmail: z
    .string()
    .trim()
    .email("כתובת אימייל לא תקינה")
    .optional()
    .or(z.literal("")),
  issueDate: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  internalNotes: z.string().max(2000).optional().or(z.literal("")),
  currency: z.string().length(3).default("ILS"),
  isTaxInclusive: z.boolean().default(false),
  vatRateSnapshot: z.number().min(0).max(100).default(17),
  subtotalAmount: moneyStr,
  taxAmount: moneyStr,
  totalAmount: moneyStr,
  amountDue: moneyStr,
  items: z.array(documentItemSchema).min(1, "יש להוסיף לפחות פריט אחד"),
  eventDate: z.string().optional().or(z.literal("")),
  eventLocation: z.string().max(500).optional().or(z.literal("")),
  eventHours: z.coerce.number().min(0).max(999).optional(),
  eventTime: z.string().max(10).optional().or(z.literal("")),
  receiptAmountReceived: posMoneyStr.optional().or(z.literal("")),
  receiptPaymentMethod: paymentMethodSchema.optional(),
  receiptPaymentReference: z.string().max(200).optional().or(z.literal("")),
  receiptCheckNumber: z.string().max(100).optional().or(z.literal("")),
  receiptCheckBank: z.string().max(100).optional().or(z.literal("")),
  receiptCheckBranch: z.string().max(100).optional().or(z.literal("")),
  receiptCheckAccount: z.string().max(100).optional().or(z.literal("")),
  receiptCheckDueDate: z.string().optional().or(z.literal("")),
});

export const saveDraftSchema = baseSaveDraftSchema.superRefine((data, ctx) => {
  if (data.type === "QUOTE") {
    if (!data.eventDate || data.eventDate.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "תאריך האירוע הוא שדה חובה",
        path: ["eventDate"],
      });
    }
    if (!data.eventLocation || data.eventLocation.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "מיקום האירוע הוא שדה חובה",
        path: ["eventLocation"],
      });
    }
    if (!data.eventTime || data.eventTime.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "שעת האירוע היא שדה חובה",
        path: ["eventTime"],
      });
    }
  }

  const isReceiptType =
    data.type === "RECEIPT" || data.type === "INVOICE_RECEIPT";

  if (!isReceiptType) {
    return;
  }

  if (!data.receiptAmountReceived) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "סכום שהתקבל הוא שדה חובה",
      path: ["receiptAmountReceived"],
    });
  }

  if (!data.receiptPaymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "אמצעי תשלום הוא שדה חובה",
      path: ["receiptPaymentMethod"],
    });
  }
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type DocumentItemInput = z.infer<typeof documentItemSchema>;
