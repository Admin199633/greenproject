import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Accepts a numeric string with up to 2dp — allows empty for optional fields */
const moneyStr = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "סכום לא תקין");

const posMoneyStr = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "סכום חייב להיות אפס או חיובי");

const qtyStr = z
  .string()
  .regex(/^\d+(\.\d{1,3})?$/, "כמות לא תקינה");

// ─── Item schema ─────────────────────────────────────────────────────────────

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

// ─── Document schema ──────────────────────────────────────────────────────────

export const saveDraftSchema = z.object({
  type: z.enum(DOCUMENT_TYPES, {
    errorMap: () => ({ message: "סוג מסמך לא תקין" }),
  }),
  customerId: z.string().min(1, "יש לבחור לקוח"),
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
  items: z
    .array(documentItemSchema)
    .min(1, "יש להוסיף לפחות פריט אחד"),
  // Photography quote fields
  eventDate: z.string().optional().or(z.literal("")),
  eventLocation: z.string().max(500).optional().or(z.literal("")),
  eventHours: z.coerce.number().min(0).max(999).optional(),
  eventTime: z.string().max(10).optional().or(z.literal("")),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type DocumentItemInput = z.infer<typeof documentItemSchema>;
