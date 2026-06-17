import { Prisma } from "@prisma/client";
import { mockDb, resetMockDb } from "@/test-utils/mockDb";
import { buildDocument, decimal } from "@/test-utils/factories";

jest.mock("@/lib/db", () => ({
  db: mockDb,
}));

import { createPayment, deletePayment } from "@/services/payment.service";

function setupCreatePaymentTransaction(options?: {
  duplicate?: boolean;
  lockedAmountDue?: string;
  aggregatePaid?: string;
  totalAmount?: string;
}) {
  const tx = {
    document: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValueOnce({
          amountDue: new Prisma.Decimal(options?.lockedAmountDue ?? "100"),
          customerId: "cust-1",
          status: "ISSUED",
        })
        .mockResolvedValueOnce({
          totalAmount: new Prisma.Decimal(options?.totalAmount ?? "100"),
        }),
      update: jest.fn(),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(
        options?.duplicate
          ? {
              id: "pay-dup",
            }
          : null
      ),
      create: jest.fn().mockResolvedValue({ id: "pay-1" }),
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          amount: new Prisma.Decimal(options?.aggregatePaid ?? "30"),
        },
      }),
      delete: jest.fn(),
    },
  };

  mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

  return tx;
}

function setupDeletePaymentTransaction(options: {
  aggregatePaid: string;
  totalAmount: string;
  documentStatus?: string;
  documentType?: string;
}) {
  const tx = {
    payment: {
      findFirst: jest.fn().mockResolvedValue({
        id: "pay-1",
        businessId: "biz-1",
        documentId: "doc-1",
        customerId: "cust-1",
        createdByUserId: "user-1",
        amount: new Prisma.Decimal("30"),
        method: "cash",
        paymentDate: new Date("2026-04-09"),
        reference: null,
        notes: null,
        document: {
          businessId: "biz-1",
          status: options.documentStatus ?? "ISSUED",
          type: options.documentType ?? "INVOICE",
        },
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          amount: new Prisma.Decimal(options.aggregatePaid),
        },
      }),
    },
    document: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        totalAmount: new Prisma.Decimal(options.totalAmount),
      }),
      update: jest.fn(),
    },
  };

  mockDb.$transaction.mockImplementation(async (callback) => callback(tx as never));

  return tx;
}

describe("payment.service", () => {
  beforeEach(() => {
    resetMockDb();
  });

  describe("createPayment", () => {
    it("can add a valid payment", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        ...buildDocument(),
      });
      const tx = setupCreatePaymentTransaction({
        aggregatePaid: "30",
        totalAmount: "100",
      });

      const result = await createPayment("biz-1", "user-1", {
        documentId: "doc-1",
        amount: "30",
        paymentDate: "2026-04-09",
        method: "cash",
        reference: "",
        notes: "",
      });

      expect(result).toEqual({ id: "pay-1" });
      expect(tx.payment.create).toHaveBeenCalled();
      expect(tx.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: {
          amountPaid: new Prisma.Decimal("30"),
          amountDue: new Prisma.Decimal("70"),
          status: "PARTIALLY_PAID",
        },
      });
    });

    it("cannot add payment to QUOTE", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        ...buildDocument({ type: "QUOTE" }),
      });

      await expect(
        createPayment("biz-1", "user-1", {
          documentId: "doc-1",
          amount: "30",
          paymentDate: "2026-04-09",
          method: "cash",
          reference: "",
          notes: "",
        })
      ).rejects.toThrow("Quotes cannot receive payments");
    });

    it("cannot add payment to CANCELLED document", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        ...buildDocument({ status: "CANCELLED" }),
      });

      await expect(
        createPayment("biz-1", "user-1", {
          documentId: "doc-1",
          amount: "30",
          paymentDate: "2026-04-09",
          method: "cash",
          reference: "",
          notes: "",
        })
      ).rejects.toThrow("Cannot add payment to a cancelled document");
    });

    it("cannot add payment to CREDIT_NOTE", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        ...buildDocument({ type: "CREDIT_NOTE" }),
      });

      await expect(
        createPayment("biz-1", "user-1", {
          documentId: "doc-1",
          amount: "30",
          paymentDate: "2026-04-09",
          method: "cash",
          reference: "",
          notes: "",
        })
      ).rejects.toThrow("Credit notes cannot receive payments");
    });

    it("cannot add payment when amountDue <= 0", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        ...buildDocument({ amountDue: decimal("0") }),
      });

      await expect(
        createPayment("biz-1", "user-1", {
          documentId: "doc-1",
          amount: "30",
          paymentDate: "2026-04-09",
          method: "cash",
          reference: "",
          notes: "",
        })
      ).rejects.toThrow("Document has no outstanding balance");
    });

    it("cannot overpay", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        ...buildDocument({ amountDue: decimal("20") }),
      });

      await expect(
        createPayment("biz-1", "user-1", {
          documentId: "doc-1",
          amount: "30",
          paymentDate: "2026-04-09",
          method: "cash",
          reference: "",
          notes: "",
        })
      ).rejects.toThrow("Payment amount exceeds remaining balance");
    });

    it("rejects duplicate payments", async () => {
      mockDb.document.findFirst.mockResolvedValue({
        ...buildDocument(),
      });
      setupCreatePaymentTransaction({ duplicate: true });

      await expect(
        createPayment("biz-1", "user-1", {
          documentId: "doc-1",
          amount: "30",
          paymentDate: "2026-04-09",
          method: "cash",
          reference: "",
          notes: "",
        })
      ).rejects.toThrow("Duplicate payment detected");
    });

    it("keeps cancelled documents blocked even if amountDue exists", async () => {
      mockDb.document.findFirst.mockResolvedValue(
        buildDocument({
          status: "CANCELLED",
          amountDue: decimal("45"),
          amountPaid: decimal("0"),
        })
      );

      await expect(
        createPayment("biz-1", "user-1", {
          documentId: "doc-1",
          amount: "10",
          paymentDate: "2026-04-09",
          method: "cash",
          reference: "",
          notes: "",
        })
      ).rejects.toThrow("Cannot add payment to a cancelled document");
    });
  });

  describe("deletePayment and status recalculation", () => {
    it("recalculates to ISSUED when totalAmount is 0", async () => {
      const tx = setupDeletePaymentTransaction({
        aggregatePaid: "10",
        totalAmount: "0",
      });

      await deletePayment("pay-1", "biz-1");

      expect(tx.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: {
          amountPaid: new Prisma.Decimal("0"),
          amountDue: new Prisma.Decimal("0"),
          status: "ISSUED",
        },
      });
    });

    it("recalculates to ISSUED when amountPaid is 0", async () => {
      const tx = setupDeletePaymentTransaction({
        aggregatePaid: "0",
        totalAmount: "100",
      });

      await deletePayment("pay-1", "biz-1");

      expect(tx.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: {
          amountPaid: new Prisma.Decimal("0"),
          amountDue: new Prisma.Decimal("100"),
          status: "ISSUED",
        },
      });
    });

    it("recalculates to PARTIALLY_PAID when payment is partial", async () => {
      const tx = setupDeletePaymentTransaction({
        aggregatePaid: "40",
        totalAmount: "100",
      });

      await deletePayment("pay-1", "biz-1");

      expect(tx.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: {
          amountPaid: new Prisma.Decimal("40"),
          amountDue: new Prisma.Decimal("60"),
          status: "PARTIALLY_PAID",
        },
      });
    });

    it("recalculates to PAID when amountPaid matches total", async () => {
      const tx = setupDeletePaymentTransaction({
        aggregatePaid: "100",
        totalAmount: "100",
      });

      await deletePayment("pay-1", "biz-1");

      expect(tx.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: {
          amountPaid: new Prisma.Decimal("100"),
          amountDue: new Prisma.Decimal("0"),
          status: "PAID",
        },
      });
    });

    it("clamps amountPaid and amountDue safely when payments exceed total", async () => {
      const tx = setupDeletePaymentTransaction({
        aggregatePaid: "150",
        totalAmount: "100",
      });

      await deletePayment("pay-1", "biz-1");

      expect(tx.document.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: {
          amountPaid: new Prisma.Decimal("100"),
          amountDue: new Prisma.Decimal("0"),
          status: "PAID",
        },
      });
    });

    it.each([
      ["RECEIPT", "receipt"],
      ["INVOICE_RECEIPT", "invoice receipt"],
    ])("cannot delete payment from CANCELLED %s", async (documentType) => {
      const tx = setupDeletePaymentTransaction({
        aggregatePaid: "30",
        totalAmount: "100",
        documentStatus: "CANCELLED",
        documentType,
      });

      await expect(deletePayment("pay-1", "biz-1")).rejects.toThrow(
        "Cannot delete payment from a cancelled document"
      );

      expect(tx.payment.delete).not.toHaveBeenCalled();
      expect(tx.payment.aggregate).not.toHaveBeenCalled();
      expect(tx.document.updateMany).not.toHaveBeenCalled();
      expect(tx.document.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(tx.document.update).not.toHaveBeenCalled();
    });

    it("keeps cancelled document status, amountPaid, and amountDue unchanged when payment deletion is rejected", async () => {
      const tx = setupDeletePaymentTransaction({
        aggregatePaid: "0",
        totalAmount: "117",
        documentStatus: "CANCELLED",
        documentType: "RECEIPT",
      });

      await expect(deletePayment("pay-1", "biz-1")).rejects.toThrow(
        "Cannot delete payment from a cancelled document"
      );

      expect(tx.payment.delete).not.toHaveBeenCalled();
      expect(tx.document.updateMany).not.toHaveBeenCalled();
      expect(tx.document.update).not.toHaveBeenCalled();
    });

    it("does not delete payment if the document is cancelled before the transactional delete guard", async () => {
      const tx = setupDeletePaymentTransaction({
        aggregatePaid: "0",
        totalAmount: "117",
        documentStatus: "ISSUED",
        documentType: "RECEIPT",
      });
      tx.document.updateMany.mockResolvedValue({ count: 0 });

      await expect(deletePayment("pay-1", "biz-1")).rejects.toThrow(
        "Cannot delete payment from a cancelled document"
      );

      expect(tx.payment.delete).not.toHaveBeenCalled();
      expect(tx.payment.aggregate).not.toHaveBeenCalled();
      expect(tx.document.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(tx.document.update).not.toHaveBeenCalled();
    });
  });
});
