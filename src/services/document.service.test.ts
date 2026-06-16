import { DocumentType, Prisma } from "@prisma/client";
import { buildCustomer, decimal } from "@/test-utils/factories";
import { mockDb, resetMockDb } from "@/test-utils/mockDb";

jest.mock("@/lib/db", () => ({
  db: mockDb,
}));

import {
  cancelDocument,
  createCreditNoteFromDocument,
  deleteDraft,
  duplicateDocument,
  issueDraft,
  updateDraft,
} from "@/services/document.service";

const draftInput = {
  customerName: "Dana Levi",
  customerPhone: "050-1234567",
  customerEmail: "dana@example.com",
  type: "INVOICE" as const,
  issueDate: "2026-04-09",
  dueDate: "2026-04-20",
  notes: "Client note",
  internalNotes: "Internal note",
  currency: "ILS",
  isTaxInclusive: false,
  vatRateSnapshot: 17,
  subtotalAmount: "100.00",
  taxAmount: "17.00",
  totalAmount: "117.00",
  amountDue: "117.00",
  items: [
    {
      lineIndex: 0,
      description: "Service",
      quantity: "1",
      unitPrice: "100.00",
      discountAmount: "0.00",
      subtotalAmount: "100.00",
      taxRate: "17.00",
      taxAmount: "17.00",
      totalAmount: "117.00",
    },
  ],
};

/** Full item mock required by computeIssuedDocumentHash (calls .toString() on all Decimal fields). */
const mockItem = {
  id: "item-1",
  lineIndex: 0,
  description: "Service",
  quantity: decimal("1"),
  unitPrice: decimal("100"),
  discountAmount: decimal("0"),
  subtotalAmount: decimal("100"),
  taxRate: decimal("17"),
  taxAmount: decimal("17"),
  totalAmount: decimal("117"),
};

/** Minimal document-level Decimal totals required by computeIssuedDocumentHash. */
const mockDocTotals = {
  subtotalAmount: decimal("100"),
  taxAmount: decimal("17"),
  totalAmount: decimal("117"),
};

function buildIssuableDocument(type: DocumentType, id = "doc-1") {
  const isReceipt =
    type === DocumentType.RECEIPT || type === DocumentType.INVOICE_RECEIPT;

  return {
    id,
    customerId: "cust-1",
    type,
    status: "DRAFT",
    issueDate: new Date("2026-04-09"),
    dueDate: null,
    items: [mockItem],
    ...mockDocTotals,
    vatRateSnapshot: decimal("17"),
    receiptAmountReceived: isReceipt ? decimal("117") : null,
    receiptPaymentMethod: isReceipt ? "cash" : null,
    receiptPaymentReference: null,
    receiptCheckNumber: null,
    receiptCheckBank: null,
    receiptCheckBranch: null,
    receiptCheckAccount: null,
    receiptCheckDueDate: null,
    customer: {
      ...buildCustomer(),
      email: null,
      address: null,
      taxId: null,
    },
  };
}

describe("document.service", () => {
  beforeEach(() => {
    resetMockDb();
  });

  describe("issueDraft", () => {
    it("can issue a draft successfully", async () => {
      const tx = {
        document: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ status: "DRAFT" }),
          update: jest.fn().mockResolvedValue({
            id: "doc-1",
            status: "ISSUED",
            number: "INV-0007",
          }),
        },
        documentCounter: {
          upsert: jest.fn().mockResolvedValue({ lastNumber: 7 }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue({
        id: "doc-1",
        type: "INVOICE",
        status: "DRAFT",
        issueDate: new Date("2026-04-09"),
        items: [mockItem],
        ...mockDocTotals,
        customer: {
          ...buildCustomer({ fullName: "Dana Levi", companyName: "Acme Ltd" }),
          email: "dana@example.com",
          address: "Tel Aviv",
          taxId: "123",
        },
      });
      mockDb.business.findUniqueOrThrow.mockResolvedValue({
        id: "biz-1",
        name: "Green Biz",
        taxId: "515151",
        address: "Haifa",
      });
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      const result = await issueDraft("doc-1", "biz-1", "user-1");

      expect(result).toEqual({
        id: "doc-1",
        status: "ISSUED",
        number: "INV-0007",
      });
    });

    it("populates number, issueDate, and snapshot fields when issuing", async () => {
      const tx = {
        document: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ status: "DRAFT" }),
          update: jest.fn().mockResolvedValue({
            id: "doc-1",
            status: "ISSUED",
            number: "INV-0007",
          }),
        },
        documentCounter: {
          upsert: jest.fn().mockResolvedValue({ lastNumber: 7 }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue({
        id: "doc-1",
        type: "INVOICE",
        status: "DRAFT",
        issueDate: new Date("2026-04-09"),
        items: [mockItem],
        ...mockDocTotals,
        customer: {
          ...buildCustomer({ fullName: "Dana Levi", companyName: "Acme Ltd" }),
          email: "dana@example.com",
          address: "Tel Aviv",
          taxId: "123",
        },
      });
      mockDb.business.findUniqueOrThrow.mockResolvedValue({
        id: "biz-1",
        name: "Green Biz",
        taxId: "515151",
        address: "Haifa",
      });
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      await issueDraft("doc-1", "biz-1", "user-1");

      expect(tx.documentCounter.upsert).toHaveBeenCalledTimes(1);
      expect(tx.documentCounter.upsert).toHaveBeenCalledWith({
        where: { businessId_type: { businessId: "biz-1", type: "INVOICE" } },
        create: { businessId: "biz-1", type: "INVOICE", lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      expect(tx.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "doc-1" },
          data: expect.objectContaining({
            status: "ISSUED",
            number: "INV-0007",
            issueDate: expect.any(Date),
            customerName: expect.stringContaining("Dana Levi"),
            customerEmail: "dana@example.com",
            customerAddress: "Tel Aviv",
            customerTaxId: "123",
            businessName: "Green Biz",
            businessTaxId: "515151",
            businessAddress: "Haifa",
          }),
        })
      );
    });

    it("preserves an existing issueDate when issuing", async () => {
      const existingIssueDate = new Date("2026-03-01T00:00:00.000Z");
      const tx = {
        document: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ status: "DRAFT" }),
          update: jest.fn().mockResolvedValue({
            id: "doc-1",
            status: "ISSUED",
            number: "INV-0007",
          }),
        },
        documentCounter: {
          upsert: jest.fn().mockResolvedValue({ lastNumber: 7 }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue({
        id: "doc-1",
        type: "INVOICE",
        status: "DRAFT",
        issueDate: existingIssueDate,
        items: [mockItem],
        ...mockDocTotals,
        customer: {
          ...buildCustomer(),
          email: null,
          address: null,
          taxId: null,
        },
      });
      mockDb.business.findUniqueOrThrow.mockResolvedValue({
        id: "biz-1",
        name: "Green Biz",
        taxId: "515151",
        address: null,
      });
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      await issueDraft("doc-1", "biz-1", "user-1");

      expect(tx.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            issueDate: existingIssueDate,
          }),
        })
      );
    });

    it.each([
      [DocumentType.QUOTE, "quoteStartNumber", "QUO-", 1165],
      [DocumentType.RECEIPT, "receiptStartNumber", "REC-", 2165],
      [DocumentType.INVOICE, "invoiceStartNumber", "INV-", 3165],
      [
        DocumentType.INVOICE_RECEIPT,
        "invoiceReceiptStartNumber",
        "INVR-",
        4165,
      ],
    ] as const)(
      "%s advances from the configured start number and increments the next issued document",
      async (type, startField, prefix, startNumber) => {
        const tx = {
          document: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ status: "DRAFT" }),
            update: jest.fn().mockImplementation(({ data }) =>
              Promise.resolve({
                id: data.number ? "issued-doc" : "paid-doc",
                status: data.status,
                number: data.number,
              })
            ),
          },
          documentCounter: {
            upsert: jest
              .fn()
              .mockResolvedValueOnce({ lastNumber: startNumber + 1 })
              .mockResolvedValueOnce({ lastNumber: startNumber + 2 }),
          },
          payment: {
            create: jest.fn().mockResolvedValue({ id: "payment-1" }),
          },
        };

        mockDb.document.findFirst
          .mockResolvedValueOnce(buildIssuableDocument(type, "doc-1"))
          .mockResolvedValueOnce(buildIssuableDocument(type, "doc-2"));
        mockDb.business.findUniqueOrThrow.mockResolvedValue({
          id: "biz-1",
          name: "Green Biz",
          taxId: "515151",
          address: "Haifa",
          taxType: "osek_murshe",
          invoiceNumberPrefix: "INV-",
          receiptNumberPrefix: "REC-",
          quoteNumberPrefix: "QUO-",
          invoiceReceiptNumberPrefix: "INVR-",
          [startField]: startNumber,
        });
        mockDb.$transaction.mockImplementation(async (callback) =>
          callback(tx as never)
        );

        await issueDraft("doc-1", "biz-1", "user-1");
        await issueDraft("doc-2", "biz-1", "user-1");

        expect(tx.documentCounter.upsert).toHaveBeenNthCalledWith(1, {
          where: { businessId_type: { businessId: "biz-1", type } },
          create: { businessId: "biz-1", type, lastNumber: startNumber + 1 },
          update: { lastNumber: { increment: 1 } },
        });
        expect(tx.documentCounter.upsert).toHaveBeenNthCalledWith(2, {
          where: { businessId_type: { businessId: "biz-1", type } },
          create: { businessId: "biz-1", type, lastNumber: startNumber + 1 },
          update: { lastNumber: { increment: 1 } },
        });

        const issuedNumbers = tx.document.update.mock.calls
          .map(([call]) => call.data.number)
          .filter(Boolean);

        expect(issuedNumbers).toEqual([
          `${prefix}${String(startNumber + 1).padStart(4, "0")}`,
          `${prefix}${String(startNumber + 2).padStart(4, "0")}`,
        ]);
      }
    );

    it.each([
      [
        DocumentType.QUOTE,
        "quoteNumberPrefix",
        "quoteStartNumber",
      ],
      [
        DocumentType.RECEIPT,
        "receiptNumberPrefix",
        "receiptStartNumber",
      ],
      [
        DocumentType.INVOICE,
        "invoiceNumberPrefix",
        "invoiceStartNumber",
      ],
      [
        DocumentType.INVOICE_RECEIPT,
        "invoiceReceiptNumberPrefix",
        "invoiceReceiptStartNumber",
      ],
    ] as const)(
      "%s treats an empty prefix as plain numeric numbering",
      async (type, prefixField, startField) => {
        const tx = {
          document: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ status: "DRAFT" }),
            update: jest.fn().mockImplementation(({ data }) =>
              Promise.resolve({
                id: data.number ? "issued-doc" : "paid-doc",
                status: data.status,
                number: data.number,
              })
            ),
          },
          documentCounter: {
            upsert: jest
              .fn()
              .mockResolvedValueOnce({ lastNumber: 80157 })
              .mockResolvedValueOnce({ lastNumber: 80158 }),
            update: jest.fn(),
          },
          payment: {
            create: jest.fn().mockResolvedValue({ id: "payment-1" }),
          },
        };

        mockDb.document.findFirst
          .mockResolvedValueOnce(buildIssuableDocument(type, "doc-1"))
          .mockResolvedValueOnce(buildIssuableDocument(type, "doc-2"));
        mockDb.business.findUniqueOrThrow.mockResolvedValue({
          id: "biz-1",
          name: "Green Biz",
          taxId: "515151",
          address: "Haifa",
          taxType: "osek_murshe",
          [prefixField]: "",
          [startField]: 80156,
        });
        mockDb.$transaction.mockImplementation(async (callback) =>
          callback(tx as never)
        );

        await issueDraft("doc-1", "biz-1", "user-1");
        await issueDraft("doc-2", "biz-1", "user-1");

        const issuedNumbers = tx.document.update.mock.calls
          .map(([call]) => call.data.number)
          .filter(Boolean);

        expect(issuedNumbers).toEqual(["80157", "80158"]);
        expect(tx.documentCounter.update).not.toHaveBeenCalled();
      }
    );

    it.each([
      [
        DocumentType.QUOTE,
        "quoteNumberPrefix",
        "quoteStartNumber",
      ],
      [
        DocumentType.RECEIPT,
        "receiptNumberPrefix",
        "receiptStartNumber",
      ],
      [
        DocumentType.INVOICE,
        "invoiceNumberPrefix",
        "invoiceStartNumber",
      ],
      [
        DocumentType.INVOICE_RECEIPT,
        "invoiceReceiptNumberPrefix",
        "invoiceReceiptStartNumber",
      ],
    ] as const)(
      "%s normalizes a numeric-only prefix into the next numeric start",
      async (type, prefixField, startField) => {
        const tx = {
          document: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ status: "DRAFT" }),
            update: jest.fn().mockImplementation(({ data }) =>
              Promise.resolve({
                id: data.number ? "issued-doc" : "paid-doc",
                status: data.status,
                number: data.number,
              })
            ),
          },
          documentCounter: {
            upsert: jest
              .fn()
              .mockResolvedValueOnce({ lastNumber: 80157 })
              .mockResolvedValueOnce({ lastNumber: 80158 }),
            update: jest.fn(),
          },
          payment: {
            create: jest.fn().mockResolvedValue({ id: "payment-1" }),
          },
        };

        mockDb.document.findFirst
          .mockResolvedValueOnce(buildIssuableDocument(type, "doc-1"))
          .mockResolvedValueOnce(buildIssuableDocument(type, "doc-2"));
        mockDb.business.findUniqueOrThrow.mockResolvedValue({
          id: "biz-1",
          name: "Green Biz",
          taxId: "515151",
          address: "Haifa",
          taxType: "osek_murshe",
          [prefixField]: "80156",
          [startField]: 1,
        });
        mockDb.$transaction.mockImplementation(async (callback) =>
          callback(tx as never)
        );

        await issueDraft("doc-1", "biz-1", "user-1");
        await issueDraft("doc-2", "biz-1", "user-1");

        expect(tx.documentCounter.upsert).toHaveBeenNthCalledWith(1, {
          where: { businessId_type: { businessId: "biz-1", type } },
          create: { businessId: "biz-1", type, lastNumber: 80157 },
          update: { lastNumber: { increment: 1 } },
        });

        const issuedNumbers = tx.document.update.mock.calls
          .map(([call]) => call.data.number)
          .filter(Boolean);

        expect(issuedNumbers).toEqual(["80157", "80158"]);
        expect(issuedNumbers).not.toContain("801560001");
      }
    );

    it("does not keep generating 801560001 after a numeric-only receipt prefix left a low counter", async () => {
      const tx = {
        document: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ status: "DRAFT" }),
          update: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: data.number ? "issued-doc" : "paid-doc",
              status: data.status,
              number: data.number,
            })
          ),
        },
        documentCounter: {
          upsert: jest.fn().mockResolvedValue({ lastNumber: 2 }),
          update: jest.fn().mockResolvedValue({ lastNumber: 80157 }),
        },
        payment: {
          create: jest.fn().mockResolvedValue({ id: "payment-1" }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue(
        buildIssuableDocument(DocumentType.RECEIPT, "doc-1")
      );
      mockDb.business.findUniqueOrThrow.mockResolvedValue({
        id: "biz-1",
        name: "Green Biz",
        taxId: "515151",
        address: "Haifa",
        taxType: "osek_murshe",
        receiptNumberPrefix: "80156",
        receiptStartNumber: 1,
      });
      mockDb.$transaction.mockImplementation(async (callback) =>
        callback(tx as never)
      );

      await issueDraft("doc-1", "biz-1", "user-1");

      expect(tx.documentCounter.update).toHaveBeenCalledWith({
        where: {
          businessId_type: {
            businessId: "biz-1",
            type: DocumentType.RECEIPT,
          },
        },
        data: { lastNumber: 80157 },
      });
      expect(tx.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            number: "80157",
          }),
        })
      );
      expect(tx.document.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            number: "801560001",
          }),
        })
      );
    });

    it("cannot issue a non-draft", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        id: "doc-1",
        status: "ISSUED",
      });

      await expect(issueDraft("doc-1", "biz-1", "user-1")).rejects.toThrow(
        "Only drafts can be issued"
      );
      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("rejects a concurrent double-issue safely during transactional re-check", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        id: "doc-1",
        type: "INVOICE",
        status: "DRAFT",
        issueDate: new Date("2026-04-09"),
        items: [mockItem],
        ...mockDocTotals,
        customer: {
          ...buildCustomer(),
          email: null,
          address: null,
          taxId: null,
        },
      });
      mockDb.business.findUniqueOrThrow.mockResolvedValue({
        id: "biz-1",
        name: "Green Biz",
        taxId: "515151",
        address: null,
      });
      const tx = {
        document: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ status: "ISSUED" }),
          update: jest.fn(),
        },
        documentCounter: {
          upsert: jest.fn(),
        },
      };
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      await expect(issueDraft("doc-1", "biz-1", "user-1")).rejects.toThrow(
        "Only drafts can be issued"
      );
      expect(tx.documentCounter.upsert).not.toHaveBeenCalled();
      expect(tx.document.update).not.toHaveBeenCalled();
    });
  });

  describe("draft immutability rules", () => {
    it("updateDraft works only for DRAFT", async () => {
      const tx = {
        documentItem: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        document: {
          update: jest.fn().mockResolvedValue({ id: "doc-1" }),
        },
        customer: {
          findFirst: jest.fn().mockResolvedValue({ id: "cust-1" }),
          create: jest.fn(),
          update: jest.fn().mockResolvedValue({ id: "cust-1" }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue({
        id: "doc-1",
        status: "DRAFT",
        customerId: "cust-1",
        sourceDocumentId: null,
      });
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      await updateDraft("doc-1", "biz-1", draftInput);

      expect(tx.documentItem.deleteMany).toHaveBeenCalledWith({
        where: { documentId: "doc-1" },
      });
      expect(tx.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: expect.objectContaining({
          customerId: "cust-1",
          type: "INVOICE",
          amountDue: "117.00",
        }),
      });
      expect(tx.documentItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            documentId: "doc-1",
            description: "Service",
            totalAmount: "117.00",
          }),
        ],
      });
    });

    it.each([
      ["ISSUED", "IMMUTABLE:"],
      ["CANCELLED", "IMMUTABLE:"],
    ])("issued immutability: %s documents cannot be updated", async (status, message) => {
      mockDb.document.findFirst.mockResolvedValue({
        id: "doc-1",
        status,
      });

      await expect(updateDraft("doc-1", "biz-1", draftInput)).rejects.toThrow(message);
      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("deleteDraft soft-deletes DRAFT documents (status → DELETED)", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        id: "doc-1",
        status: "DRAFT",
      });
      mockDb.document.update.mockResolvedValue({ id: "doc-1", status: "DELETED" });

      await deleteDraft("doc-1", "biz-1");

      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { status: "DELETED" },
      });
      expect(mockDb.document.delete).not.toHaveBeenCalled();
    });

    it.each([
      ["ISSUED", "IMMUTABLE:"],
      ["CANCELLED", "IMMUTABLE:"],
    ])("issued immutability: %s documents cannot be deleted", async (status, message) => {
      mockDb.document.findFirst.mockResolvedValue({
        id: "doc-1",
        status,
      });

      await expect(deleteDraft("doc-1", "biz-1")).rejects.toThrow(message);
      expect(mockDb.document.delete).not.toHaveBeenCalled();
    });
  });

  describe("cancelDocument", () => {
    it("can cancel only an issued document with amountPaid = 0", async () => {
      const tx = {
        document: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            status: "ISSUED",
            amountPaid: decimal("0"),
          }),
          update: jest.fn().mockResolvedValue({
            id: "doc-1",
            status: "CANCELLED",
          }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue({
        status: "ISSUED",
        amountPaid: decimal("0"),
      });
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      const result = await cancelDocument("doc-1", "biz-1");

      expect(result).toEqual({ id: "doc-1", status: "CANCELLED" });
      expect(tx.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { status: "CANCELLED" },
      });
    });

    it.each([
      ["DRAFT", "Draft documents cannot be cancelled"],
      ["PARTIALLY_PAID", "Partially paid documents cannot be cancelled"],
      ["PAID", "Paid documents cannot be cancelled"],
      ["CANCELLED", "Document is already cancelled"],
    ])("cannot cancel %s documents", async (status, message) => {
      mockDb.document.findFirst.mockResolvedValue({
        status,
        amountPaid: decimal("0"),
      });

      await expect(cancelDocument("doc-1", "biz-1")).rejects.toThrow(message);
      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("cannot cancel documents with payments", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        status: "ISSUED",
        amountPaid: decimal("5"),
      });

      await expect(cancelDocument("doc-1", "biz-1")).rejects.toThrow(
        "Documents with payments cannot be cancelled"
      );
    });

    it("cancel changes only status to CANCELLED", async () => {
      const tx = {
        document: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            status: "ISSUED",
            amountPaid: decimal("0"),
            number: "INV-0001",
            totalAmount: decimal("117"),
            customerName: "Acme",
          }),
          update: jest.fn().mockResolvedValue({
            id: "doc-1",
            status: "CANCELLED",
          }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue({
        status: "ISSUED",
        amountPaid: decimal("0"),
      });
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      await cancelDocument("doc-1", "biz-1");

      expect(tx.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { status: "CANCELLED" },
      });
      const updateData = tx.document.update.mock.calls[0][0].data;
      expect(Object.keys(updateData)).toEqual(["status"]);
    });
  });

  describe("createCreditNoteFromDocument", () => {
    it("creates a credit note draft from an eligible source document", async () => {
      const tx = {
        document: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: "src-1",
            businessId: "biz-1",
            customerId: "cust-1",
            type: "INVOICE",
            status: "PAID",
            notes: "Original notes",
            internalNotes: "Internal notes",
            currency: "ILS",
            isTaxInclusive: false,
            vatRateSnapshot: decimal("17"),
            subtotalAmount: decimal("100"),
            taxAmount: decimal("17"),
            totalAmount: decimal("117"),
            customerName: "Acme Ltd",
            customerEmail: "billing@acme.test",
            customerAddress: "Tel Aviv",
            customerTaxId: "123",
            businessName: "Green Biz",
            businessTaxId: "515151",
            businessAddress: "Haifa",
            creditNote: null,
            items: [
              {
                lineIndex: 0,
                description: "Service",
                quantity: decimal("1"),
                unitPrice: decimal("100"),
                discountAmount: decimal("0"),
                subtotalAmount: decimal("100"),
                taxRate: decimal("17"),
                taxAmount: decimal("17"),
                totalAmount: decimal("117"),
              },
            ],
          }),
          create: jest.fn().mockResolvedValue({ id: "cn-1", customerId: "cust-1" }),
        },
        documentItem: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue({
        id: "src-1",
        businessId: "biz-1",
        customerId: "cust-1",
        type: "INVOICE",
        status: "PAID",
        notes: "Original notes",
        internalNotes: "Internal notes",
        currency: "ILS",
        isTaxInclusive: false,
        vatRateSnapshot: decimal("17"),
        subtotalAmount: decimal("100"),
        taxAmount: decimal("17"),
        totalAmount: decimal("117"),
        customerName: "Acme Ltd",
        customerEmail: "billing@acme.test",
        customerAddress: "Tel Aviv",
        customerTaxId: "123",
        businessName: "Green Biz",
        businessTaxId: "515151",
        businessAddress: "Haifa",
        creditNote: null,
        items: [
          {
            lineIndex: 0,
            description: "Service",
            quantity: decimal("1"),
            unitPrice: decimal("100"),
            discountAmount: decimal("0"),
            subtotalAmount: decimal("100"),
            taxRate: decimal("17"),
            taxAmount: decimal("17"),
            totalAmount: decimal("117"),
          },
        ],
      });
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      const result = await createCreditNoteFromDocument("src-1", "biz-1");

      expect(result).toEqual({ id: "cn-1", customerId: "cust-1" });
      expect(tx.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: "biz-1",
          customerId: "cust-1",
          sourceDocumentId: "src-1",
          type: "CREDIT_NOTE",
          status: "DRAFT",
          amountPaid: "0",
          amountDue: decimal("117"),
          customerName: "Acme Ltd",
          businessName: "Green Biz",
        }),
      });
      expect(tx.documentItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            documentId: "cn-1",
            description: "Service",
            totalAmount: decimal("117"),
          }),
        ],
      });
    });

    it.each([
      ["QUOTE", "ISSUED", "Document type cannot be credited"],
      ["RECEIPT", "ISSUED", "Document type cannot be credited"],
      ["CREDIT_NOTE", "ISSUED", "Document type cannot be credited"],
      ["INVOICE", "DRAFT", "Only issued documents can create a credit note"],
      ["INVOICE", "CANCELLED", "Only issued documents can create a credit note"],
    ])(
      "rejects ineligible source type/status (%s, %s)",
      async (type, status, message) => {
        mockDb.document.findFirst.mockResolvedValue({
          id: "src-1",
          type,
          status,
          creditNote: null,
          items: [],
        });

        await expect(createCreditNoteFromDocument("src-1", "biz-1")).rejects.toThrow(
          message
        );
      }
    );

    it("rejects duplicate credit note creation", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        id: "src-1",
        type: "INVOICE",
        status: "ISSUED",
        creditNote: { id: "cn-1" },
        items: [],
      });

      await expect(createCreditNoteFromDocument("src-1", "biz-1")).rejects.toThrow(
        "Credit note already exists for this document"
      );
    });
  });

  describe("duplicateDocument", () => {
    const sourceItems = [
      {
        lineIndex: 0,
        description: "Service A",
        quantity: decimal("2"),
        unitPrice: decimal("50"),
        discountAmount: decimal("0"),
        subtotalAmount: decimal("100"),
        taxRate: decimal("17"),
        taxAmount: decimal("17"),
        totalAmount: decimal("117"),
      },
    ];

    const sourceDoc = {
      id: "src-1",
      businessId: "biz-1",
      customerId: "cust-1",
      type: "INVOICE",
      status: "ISSUED",
      number: "INV-0001",
      issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-04-30"),
      notes: "Original notes",
      internalNotes: "Internal",
      currency: "ILS",
      isTaxInclusive: false,
      vatRateSnapshot: decimal("17"),
      subtotalAmount: decimal("100"),
      taxAmount: decimal("17"),
      totalAmount: decimal("117"),
      items: sourceItems,
    };

    it("creates a DRAFT with no number, copied items, and amountPaid=0", async () => {
      const createdDraft = { id: "draft-1", status: "DRAFT", number: null };
      const tx = {
        document: {
          create: jest.fn().mockResolvedValue(createdDraft),
        },
        documentItem: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue(sourceDoc);
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      const result = await duplicateDocument("src-1", "biz-1");

      expect(result).toEqual(createdDraft);

      const createCall = tx.document.create.mock.calls[0][0];
      expect(createCall.data.status).toBe("DRAFT");
      expect(createCall.data.number).toBeNull();
      expect(createCall.data.amountPaid.toString()).toBe("0");
      expect(createCall.data.businessId).toBe("biz-1");
      expect(createCall.data.customerId).toBe("cust-1");
      expect(createCall.data.type).toBe("INVOICE");
    });

    it("copies all line items from the source", async () => {
      const tx = {
        document: {
          create: jest.fn().mockResolvedValue({ id: "draft-1" }),
        },
        documentItem: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue(sourceDoc);
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      await duplicateDocument("src-1", "biz-1");

      expect(tx.documentItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              description: "Service A",
              quantity: decimal("2"),
              unitPrice: decimal("50"),
              lineIndex: 0,
            }),
          ]),
        })
      );
    });

    it("throws Document not found when document belongs to another business", async () => {
      mockDb.document.findFirst.mockResolvedValue(null);

      await expect(duplicateDocument("src-1", "other-biz")).rejects.toThrow(
        "Document not found"
      );
    });

    it("clears all snapshot fields on the duplicate", async () => {
      const tx = {
        document: {
          create: jest.fn().mockResolvedValue({ id: "draft-1" }),
        },
        documentItem: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      mockDb.document.findFirst.mockResolvedValue(sourceDoc);
      mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

      await duplicateDocument("src-1", "biz-1");

      const createData = tx.document.create.mock.calls[0][0].data;
      expect(createData.customerName).toBeNull();
      expect(createData.customerEmail).toBeNull();
      expect(createData.businessName).toBeNull();
      expect(createData.businessTaxId).toBeNull();
      expect(createData.issueDate).toBeNull();
    });
  });
});
