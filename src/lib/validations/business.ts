import { z } from "zod";

const optionalStr = (max: number, label: string) =>
  z.string().max(max, `${label} ארוך מדי`).optional().or(z.literal(""));

export const DEFAULT_DOCUMENT_START_NUMBER = 0;
export const MAX_DOCUMENT_START_NUMBER = 2147483646;

const NUMERIC_ONLY_PREFIX_RE = /^\d+$/;

const startNumber = (label: string) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce
      .number()
      .int(`${label} חייב להיות מספר שלם`)
      .min(0, `${label} לא יכול להיות שלילי`)
      .max(MAX_DOCUMENT_START_NUMBER, `${label} גדול מדי`)
      .optional()
      .default(DEFAULT_DOCUMENT_START_NUMBER)
  );

type BusinessNumberingInput = {
  invoiceNumberPrefix?: string | null;
  invoiceStartNumber?: number | null;
  receiptNumberPrefix?: string | null;
  receiptStartNumber?: number | null;
  quoteNumberPrefix?: string | null;
  quoteStartNumber?: number | null;
  invoiceReceiptNumberPrefix?: string | null;
  invoiceReceiptStartNumber?: number | null;
};

function normalizeStartNumber(value?: number | null) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= DEFAULT_DOCUMENT_START_NUMBER &&
    value <= MAX_DOCUMENT_START_NUMBER
    ? value
    : DEFAULT_DOCUMENT_START_NUMBER;
}

function parseNumericOnlyPrefix(prefix: string) {
  if (!NUMERIC_ONLY_PREFIX_RE.test(prefix)) {
    return { isNumericOnly: false, startNumber: null };
  }

  const parsed = Number(prefix);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_DOCUMENT_START_NUMBER
  ) {
    return { isNumericOnly: true, startNumber: null };
  }

  return { isNumericOnly: true, startNumber: parsed };
}

function normalizePrefixAndStart(
  prefix: string | null | undefined,
  start: number | null | undefined,
  defaultPrefix: string
) {
  const trimmedPrefix = prefix == null ? defaultPrefix : prefix.trim();
  const normalizedStart = normalizeStartNumber(start);
  const numericPrefix = parseNumericOnlyPrefix(trimmedPrefix);

  if (numericPrefix.isNumericOnly) {
    return {
      prefix: "",
      startNumber: numericPrefix.startNumber ?? normalizedStart,
    };
  }

  return {
    prefix: trimmedPrefix,
    startNumber: normalizedStart,
  };
}

export function normalizeBusinessNumbering(input: BusinessNumberingInput) {
  const invoice = normalizePrefixAndStart(
    input.invoiceNumberPrefix,
    input.invoiceStartNumber,
    "INV-"
  );
  const receipt = normalizePrefixAndStart(
    input.receiptNumberPrefix,
    input.receiptStartNumber,
    "REC-"
  );
  const quote = normalizePrefixAndStart(
    input.quoteNumberPrefix,
    input.quoteStartNumber,
    "QUO-"
  );
  const invoiceReceipt = normalizePrefixAndStart(
    input.invoiceReceiptNumberPrefix,
    input.invoiceReceiptStartNumber,
    "INVR-"
  );

  return {
    invoiceNumberPrefix: invoice.prefix,
    invoiceStartNumber: invoice.startNumber,
    receiptNumberPrefix: receipt.prefix,
    receiptStartNumber: receipt.startNumber,
    quoteNumberPrefix: quote.prefix,
    quoteStartNumber: quote.startNumber,
    invoiceReceiptNumberPrefix: invoiceReceipt.prefix,
    invoiceReceiptStartNumber: invoiceReceipt.startNumber,
  };
}

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
}).superRefine((data, ctx) => {
  const prefixFields = [
    ["invoiceNumberPrefix", "קידומת חשבונית"],
    ["receiptNumberPrefix", "קידומת קבלה"],
    ["quoteNumberPrefix", "קידומת הצעת מחיר"],
    ["invoiceReceiptNumberPrefix", "קידומת חשבונית קבלה"],
  ] as const;

  for (const [field, label] of prefixFields) {
    const value = data[field]?.trim() ?? "";
    const numericPrefix = parseNumericOnlyPrefix(value);
    if (numericPrefix.isNumericOnly && numericPrefix.startNumber == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} מספרית גדולה מדי`,
        path: [field],
      });
    }
  }
}).transform((data) => ({
  ...data,
  ...normalizeBusinessNumbering(data),
}));

export type BusinessFormValues = z.infer<typeof businessSchema>;
