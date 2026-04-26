import { z } from "zod";

export const savedItemSchema = z.object({
  name: z.string().min(1, "שם חובה").max(200, "שם ארוך מדי"),
  description: z
    .string()
    .max(500, "תיאור ארוך מדי")
    .optional()
    .or(z.literal("")),
  defaultPrice: z.coerce
    .number()
    .min(0, "מחיר לא יכול להיות שלילי")
    .default(0),
  unit: z.string().max(50, "יחידה ארוכה מדי").optional().or(z.literal("")),
});

export type SavedItemInput = z.infer<typeof savedItemSchema>;
