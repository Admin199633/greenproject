import { z } from "zod";

const optionalStr = (max: number, label: string) =>
  z.string().max(max, `${label} ארוך מדי`).optional().or(z.literal(""));

export const customerSchema = z
  .object({
    fullName: optionalStr(200, "שם מלא"),
    companyName: optionalStr(200, "שם חברה"),
    email: z
      .string()
      .email("כתובת אימייל לא תקינה")
      .optional()
      .or(z.literal("")),
    phone: optionalStr(30, "מספר טלפון"),
    address: optionalStr(500, "כתובת"),
    taxId: optionalStr(20, "מספר עוסק"),
    notes: optionalStr(2000, "הערות"),
  })
  .refine(
    (data) => !!(data.fullName?.trim() || data.companyName?.trim()),
    {
      message: "יש למלא שם מלא או שם חברה — לפחות אחד מהם חובה",
      path: ["fullName"],
    }
  );

export type CustomerFormValues = z.infer<typeof customerSchema>;
