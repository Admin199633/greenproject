import { buildCustomer, decimal } from "@/test-utils/factories";

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn((_config?: unknown) => ({ sendMail: mockSendMail }));
const renderDocumentPdf = jest.fn();
const getDocumentById = jest.fn();

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: (config: unknown) => mockCreateTransport(config),
  },
}));

jest.mock("@/lib/pdf/document-pdf", () => ({
  renderDocumentPdf: (...args: unknown[]) => renderDocumentPdf(...args),
}));

jest.mock("@/services/document.service", () => ({
  getDocumentById: (...args: unknown[]) => getDocumentById(...args),
}));

jest.mock("@/lib/db", () => ({
  db: {
    business: {
      findUniqueOrThrow: jest.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { sendDocumentEmail } from "@/services/email.service";

describe("email.service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "mailer",
      SMTP_PASS: "secret",
      SMTP_FROM: "sender@example.com",
      NEXTAUTH_URL: "https://app.example.com",
      NEXTAUTH_SECRET: "test-secret",
    };

    getDocumentById.mockResolvedValue({
      id: "doc-1",
      status: "ISSUED",
      type: "QUOTE",
      number: "QUO-0001",
      currency: "ILS",
      totalAmount: decimal("117"),
      customerName: "Dana Levi",
      customerEmail: null,
      issuedHash: "issued-hash-1",
      customer: {
        ...buildCustomer({ fullName: "Dana Levi" }),
        email: "customer@example.com",
      },
    });

    (db.business.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: "biz-1",
      email: "business@example.com",
      phone: "050-0000000",
      address: "Tel Aviv",
      logo: "https://cdn.example.com/logo.png",
      name: "PhotoTop",
    });

    renderDocumentPdf.mockResolvedValue(Buffer.from("pdf"));
    mockSendMail.mockResolvedValue({ messageId: "msg-1" });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("issue delivery sends to the business and customer when customer email exists", async () => {
    const result = await sendDocumentEmail("doc-1", "biz-1", {
      audience: "issue",
      origin: "https://custom.example.com",
    });

    expect(result.to).toEqual(["business@example.com", "customer@example.com"]);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["business@example.com", "customer@example.com"],
        html: expect.stringContaining("צפייה / הורדת PDF"),
        text: expect.stringContaining("https://custom.example.com/green/api/public/documents/doc-1/pdf?token="),
        attachments: [
          expect.objectContaining({
            filename: "QUO-0001.pdf",
          }),
        ],
      })
    );
  });

  it("issue delivery sends only to the business when customer email is missing", async () => {
    getDocumentById.mockResolvedValue({
      id: "doc-1",
      status: "ISSUED",
      type: "QUOTE",
      number: "QUO-0001",
      currency: "ILS",
      totalAmount: decimal("117"),
      customerName: "Dana Levi",
      customerEmail: null,
      issuedHash: "issued-hash-1",
      customer: {
        ...buildCustomer({ fullName: "Dana Levi" }),
        email: null,
      },
    });

    const result = await sendDocumentEmail("doc-1", "biz-1", {
      audience: "issue",
    });

    expect(result.to).toEqual(["business@example.com"]);
  });

  it("manual resend sends only to the customer", async () => {
    const result = await sendDocumentEmail("doc-1", "biz-1", {
      audience: "customer",
    });

    expect(result.to).toEqual(["customer@example.com"]);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["customer@example.com"],
      })
    );
  });

  it("manual resend fails when the customer has no email", async () => {
    getDocumentById.mockResolvedValue({
      id: "doc-1",
      status: "ISSUED",
      type: "QUOTE",
      number: "QUO-0001",
      currency: "ILS",
      totalAmount: decimal("117"),
      customerName: "Dana Levi",
      customerEmail: null,
      issuedHash: "issued-hash-1",
      customer: {
        ...buildCustomer({ fullName: "Dana Levi" }),
        email: null,
      },
    });

    await expect(
      sendDocumentEmail("doc-1", "biz-1", { audience: "customer" })
    ).rejects.toThrow("Customer has no email address");
  });

  it("falls back to link-only mail when pdf generation fails", async () => {
    renderDocumentPdf.mockRejectedValue(new Error("pdf failed"));

    const result = await sendDocumentEmail("doc-1", "biz-1", {
      audience: "customer",
      origin: "https://custom.example.com",
    });

    expect(result.attachedPdf).toBe(false);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("https://custom.example.com/green/api/public/documents/doc-1/pdf?token="),
        attachments: [],
      })
    );
  });
});
