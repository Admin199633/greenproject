import { assertDocumentPdfAllowed } from "@/services/document-pdf.service";

describe("document-pdf.service", () => {
  it.each(["ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"])(
    "allows %s invoice PDFs",
    (status) => {
      expect(() =>
        assertDocumentPdfAllowed({
          status,
          type: "INVOICE",
          payments: [],
        })
      ).not.toThrow();
    }
  );

  it("keeps draft PDFs blocked", () => {
    expect(() =>
      assertDocumentPdfAllowed({
        status: "DRAFT",
        type: "INVOICE",
        payments: [],
      })
    ).toThrow("DRAFT_PDF_NOT_ALLOWED");
  });

  it("allows cancelled receipt PDFs when the original payment is preserved", () => {
    expect(() =>
      assertDocumentPdfAllowed({
        status: "CANCELLED",
        type: "RECEIPT",
        payments: [{ method: "cash" }],
      })
    ).not.toThrow();
  });

  it("keeps receipt payment validation for cancelled receipt PDFs", () => {
    expect(() =>
      assertDocumentPdfAllowed({
        status: "CANCELLED",
        type: "RECEIPT",
        payments: [],
      })
    ).toThrow("RECEIPT_PAYMENT_REQUIRED");
  });
});
