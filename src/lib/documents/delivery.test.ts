import {
  buildAbsoluteUrl,
  buildDocumentPdfPath,
  buildWhatsappMessage,
  buildWhatsappShareUrl,
} from "@/lib/documents/delivery";

describe("document delivery helpers", () => {
  it("builds a pdf path under /green", () => {
    expect(buildDocumentPdfPath("doc-123")).toBe("/green/api/documents/doc-123/pdf");
  });

  it("builds an absolute url when origin is provided", () => {
    expect(buildAbsoluteUrl("/green/documents/doc-1", "https://app.example.com/")).toBe(
      "https://app.example.com/green/documents/doc-1"
    );
  });

  it("builds a whatsapp message with document details", () => {
    expect(
      buildWhatsappMessage({
        customerName: "דנה",
        type: "QUOTE",
        documentNumber: "QUO-0007",
        totalAmount: "₪117.00",
        pdfUrl: "https://app.example.com/green/api/documents/doc-1/pdf",
      })
    ).toContain("הצעת מחיר מספר QUO-0007");
  });

  it("builds a whatsapp share url with a normalized phone", () => {
    const url = buildWhatsappShareUrl(
      "050-1234567",
      "hello world"
    );

    expect(url).toBe("https://wa.me/972501234567?text=hello%20world");
  });
});
