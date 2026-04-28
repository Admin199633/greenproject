describe("document delivery helpers", () => {
  it("builds a public pdf path under /green", async () => {
    const { buildPublicDocumentPdfPath } = await import("@/lib/documents/delivery");
    const path = buildPublicDocumentPdfPath("doc-123", "token-123");

    expect(path).toBe("/green/api/public/documents/doc-123/pdf?token=token-123");
  });

  it("builds an absolute url when origin is provided", async () => {
    const { buildAbsoluteUrl } = await import("@/lib/documents/delivery");
    expect(buildAbsoluteUrl("/green/documents/doc-1", "https://app.example.com/")).toBe(
      "https://app.example.com/green/documents/doc-1"
    );
  });

  it("builds a whatsapp message with document details", async () => {
    const { buildWhatsappMessage } = await import("@/lib/documents/delivery");

    expect(
      buildWhatsappMessage({
        customerName: "דנה",
        type: "QUOTE",
        documentNumber: "QUO-0007",
        totalAmount: "₪117.00",
        pdfUrl: "https://files.example.com/doc.pdf",
      })
    ).toContain("הצעת מחיר מספר QUO-0007");
  });

  it("builds a whatsapp share url with a normalized phone", async () => {
    const { buildWhatsappShareUrl } = await import("@/lib/documents/delivery");
    const url = buildWhatsappShareUrl("050-1234567", "hello world");

    expect(url).toBe("https://wa.me/972501234567?text=hello%20world");
  });

  it("builds an approval whatsapp message", async () => {
    const { buildApprovalWhatsappMessage } = await import("@/lib/documents/delivery");

    const message = buildApprovalWhatsappMessage({
      customerName: "דנה",
      approvalUrl: "https://app.example.com/green/a/token-1",
    });
    expect(message).toContain("היי דנה 👋");
    expect(message).toContain("שלחתי לך הצעת מחיר מפוטופ 📸");
    expect(message).toContain("https://app.example.com/green/a/token-1");
    expect(message).toContain("לאחר האישור התאריך יישמר עבורך ✅");
  });

  it("builds a whatsapp share url without a phone", async () => {
    const { buildWhatsappShareUrl } = await import("@/lib/documents/delivery");
    const url = buildWhatsappShareUrl("", "hello world");

    expect(url).toBe("https://wa.me/?text=hello%20world");
  });

  it("renders a premium html email with a public pdf cta", async () => {
    const { buildDocumentEmailHtml } = await import("@/lib/documents/delivery");
    const html = buildDocumentEmailHtml({
      customerName: "דנה",
      businessName: "פוטופ",
      businessLogo: "https://cdn.example.com/logo.png",
      businessPhone: "050-0000000",
      businessEmail: "hello@example.com",
      businessAddress: "תל אביב",
      type: "QUOTE",
      documentNumber: "QUO-0007",
      totalAmount: "₪117.00",
      pdfUrl: "https://files.example.com/doc.pdf",
    });

    expect(html).toContain('dir="rtl"');
    expect(html).toContain("צפייה / הורדת PDF");
    expect(html).toContain("https://files.example.com/doc.pdf");
    expect(html).not.toContain("/green/dashboard");
    expect(html).not.toContain("/green/documents/");
  });
});
