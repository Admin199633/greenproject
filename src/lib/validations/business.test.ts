import { businessSchema } from "@/lib/validations/business";

const validBusinessInput = {
  name: "Green Biz",
  taxId: "515151",
};

describe("businessSchema numbering normalization", () => {
  it("moves a numeric-only prefix with spaces into the matching start number", () => {
    const parsed = businessSchema.parse({
      ...validBusinessInput,
      receiptNumberPrefix: " 80156 ",
    });

    expect(parsed.receiptNumberPrefix).toBe("");
    expect(parsed.receiptStartNumber).toBe(80156);
  });

  it("treats leading-zero numeric prefixes as numeric start values", () => {
    const parsed = businessSchema.parse({
      ...validBusinessInput,
      invoiceNumberPrefix: "00123",
    });

    expect(parsed.invoiceNumberPrefix).toBe("");
    expect(parsed.invoiceStartNumber).toBe(123);
  });

  it("keeps mixed text-and-number prefixes as prefixes", () => {
    const parsed = businessSchema.parse({
      ...validBusinessInput,
      quoteNumberPrefix: "REC80156",
    });

    expect(parsed.quoteNumberPrefix).toBe("REC80156");
    expect(parsed.quoteStartNumber).toBe(0);
  });

  it("rejects numeric-only prefixes that cannot become a valid start number", () => {
    const parsed = businessSchema.safeParse({
      ...validBusinessInput,
      invoiceReceiptNumberPrefix: "2147483647",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.invoiceReceiptNumberPrefix).toEqual([
        "קידומת חשבונית קבלה מספרית גדולה מדי",
      ]);
    }
  });

  it("rejects negative start numbers", () => {
    const parsed = businessSchema.safeParse({
      ...validBusinessInput,
      receiptStartNumber: -1,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.receiptStartNumber).toEqual([
        "מספר התחלתי לקבלה לא יכול להיות שלילי",
      ]);
    }
  });
});
