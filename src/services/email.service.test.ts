import { buildCustomer, decimal } from "@/test-utils/factories";

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
const renderDocumentPdf = jest.fn();
const getDocumentById = jest.fn();

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: (...args: unknown[]) => mockCreateTransport(...args),
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
    };

    getDocumentById.mockResolvedValue({
      id: "doc-1",
      status: "ISSUED",
      type: "QUOTE",
      number: "QUO-0001",
      totalAmount: decimal("117"),
      customerName: "Dana Levi",
      customerEmail: null,
      customer: {
        ...buildCustomer({ fullName: "Dana Levi" }),
        email: "customer@example.com",
      },
    });

    (db.business.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: "biz-1",
      email: "business@example.com",
      name: "PhotoTop",
    });

    renderDocumentPdf.mockResolvedValue(Buffer.from("pdf"));
    mockSendMail.mockResolvedValue({ messageId: "msg-1" });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("sends to the business and customer when customer email exists", async () => {
    const result = await sendDocumentEmail("doc-1", "biz-1");

    expect(result.to).toEqual(["business@example.com", "customer@example.com"]);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["business@example.com", "customer@example.com"],
        attachments: [
          expect.objectContaining({
            filename: "QUO-0001.pdf",
          }),
        ],
      })
    );
  });

  it("sends only to the business when customer email is missing", async () => {
    getDocumentById.mockResolvedValue({
      id: "doc-1",
      status: "ISSUED",
      type: "QUOTE",
      number: "QUO-0001",
      totalAmount: decimal("117"),
      customerName: "Dana Levi",
      customerEmail: null,
      customer: {
        ...buildCustomer({ fullName: "Dana Levi" }),
        email: null,
      },
    });

    const result = await sendDocumentEmail("doc-1", "biz-1");

    expect(result.to).toEqual(["business@example.com"]);
  });

  it("falls back to link-only mail when pdf generation fails", async () => {
    renderDocumentPdf.mockRejectedValue(new Error("pdf failed"));

    const result = await sendDocumentEmail("doc-1", "biz-1", {
      origin: "https://custom.example.com",
    });

    expect(result.attachedPdf).toBe(false);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("https://custom.example.com/green/api/documents/doc-1/pdf"),
        attachments: [],
      })
    );
  });
});
