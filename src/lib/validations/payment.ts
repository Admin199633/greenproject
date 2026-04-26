import { z } from "zod";

export const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "credit_card",
  "check",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "מזומן",
  bank_transfer: "העברה בנקאית",
  credit_card: "כרטיס אשראי",
  check: "שיק",
  other: "אחר",
};

export const createPaymentSchema = z.object({
  documentId: z.string().min(1, "נדרש מסמך"),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "סכום לא תקין")
    .refine((v) => parseFloat(v) > 0, "הסכום חייב להיות גדול מאפס"),
  paymentDate: z.string().min(1, "תאריך תשלום חובה"),
  method: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: "אמצעי תשלום לא תקין" }),
  }),
  reference: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
