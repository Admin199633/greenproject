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
    expect(
      buildApprovalWhatsappMessage({
        customerName: "דנה",
        approvalUrl: "https://app.example.com/green/a/token-1",
      })
    ).toBe(
      `היי דנה 👋

שלחתי לך הצעת מחיר מפוטופ 📸

לצפייה בפרטי ההצעה ואישור התאריך:
https://app.example.com/green/a/token-1

לאחר האישור התאריך יישמר עבורך ✅

לכל שאלה אני כאן 🙂`
    );
    return;

    const message = buildApprovalWhatsappMessage({
      customerName: "דנה",
      approvalUrl: "https://app.example.com/green/a/token-1",
    });
    expect(message).toBe(
      `היי דנה 

שלחתי לך הצעת מחיר מפוטופ 

לצפייה בפרטי ההצעה ואישור התאריך:
https://app.example.com/green/a/token-1

לאחר האישור התאריך יישמר עבורך ✅

לכל שאלה אני כאן `
    );
  });

  it("builds a whatsapp share url without a phone", async () => {
    const { buildWhatsappShareUrl } = await import("@/lib/documents/delivery");
    const url = buildWhatsappShareUrl("", "hello world");

    expect(url).toBe("https://wa.me/?text=hello%20world");
  });

  it("renders a custom approval whatsapp template with safe fallbacks", async () => {
    const { buildApprovalShareMessage } = await import("@/lib/documents/delivery");

    const message = buildApprovalShareMessage({
      customerName: " ",
      approvalUrl: "https://app.example.com/green/a/token-1",
      businessName: "",
      eventDate: undefined,
      eventTime: "18:30",
      eventLocation: null,
      template:
        "שלום {customerName}\nעסק: {businessName}\nתאריך: {eventDate}\nשעה: {eventTime}\nמיקום: {eventLocation}\nאישור: {approvalUrl}",
    });

    expect(message).toBe(
      "שלום לקוח\nעסק: —\nתאריך: —\nשעה: 18:30\nמיקום: —\nאישור: https://app.example.com/green/a/token-1"
    );
  });

  it("falls back to the default approval whatsapp template when template is empty", async () => {
    const { buildApprovalShareMessage } = await import("@/lib/documents/delivery");

    const message = buildApprovalShareMessage({
      customerName: "דנה",
      approvalUrl: "https://app.example.com/green/a/token-1",
      template: "   ",
    });

    expect(message).toContain("היי דנה 👋");
    expect(message).toContain("שלחתי לך הצעת מחיר מפוטופ 📸");
    expect(message).toContain("לאחר האישור התאריך יישמר עבורך ✅");
  });

  it("builds a whatsapp share url for hebrew text without replacement chars", async () => {
    const { buildWhatsappShareUrl } = await import("@/lib/documents/delivery");
    const safeUrl = buildWhatsappShareUrl(
      "050-1234567",
      `היי דנה 👋

שלחתי לך הצעת מחיר מפוטופ 📸

לצפייה בפרטי ההצעה ואישור התאריך:
https://app.example.com/green/a/token-1

לאחר האישור התאריך יישמר עבורך ✅

לכל שאלה אני כאן 🙂`
    );

    expect(safeUrl).toContain("https://wa.me/972501234567?text=");
    expect(safeUrl).not.toContain("\uFFFD");
    return;

    const url = buildWhatsappShareUrl(
      "050-1234567",
      `היי דנה 

שלחתי לך הצעת מחיר מפוטופ 

לצפייה בפרטי ההצעה ואישור התאריך:
https://app.example.com/green/a/token-1

לאחר האישור התאריך יישמר עבורך ✅

לכל שאלה אני כאן `
    );

    expect(url).toContain("https://wa.me/972501234567?text=");
    expect(url).not.toContain("\uFFFD");
  });

  it("builds the owner approval redirect message with em-dash fallbacks", async () => {
    const { buildOwnerApprovalRedirectWhatsappMessage } = await import(
      "@/lib/documents/delivery"
    );

    const message = buildOwnerApprovalRedirectWhatsappMessage({
      customerName: "דנה",
      customerPhone: "050-1234567",
      eventDate: "12.05.2026",
      eventTime: "10:30",
    });

    expect(message).toBe(
      [
        "הי ליאור",
        "הצעת מחיר אושרה ✅",
        "",
        "לקוח: דנה",
        "טלפון: 050-1234567",
        "תאריך האירוע: 12.05.2026",
        "שעה: 10:30",
      ].join("\n")
    );

    const fallback = buildOwnerApprovalRedirectWhatsappMessage({
      customerName: "",
      customerPhone: null,
      eventDate: undefined,
      eventTime: "  ",
    });
    expect(fallback).toContain("לקוח: —");
    expect(fallback).toContain("טלפון: —");
    expect(fallback).toContain("תאריך האירוע: —");
    expect(fallback).toContain("שעה: —");
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
