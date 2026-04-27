describe("document delivery helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXTAUTH_SECRET: "test-secret",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("builds a public pdf path under /green", async () => {
    const { buildPublicDocumentPdfPath } = await import("@/lib/documents/public-pdf");
    const path = buildPublicDocumentPdfPath("doc-123", "hash-123");

    expect(path).toMatch(/^\/green\/api\/public\/documents\/doc-123\/pdf\?token=/);
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
