import { Prisma } from "@prisma/client";
import { mockDb, resetMockDb } from "@/test-utils/mockDb";
import { buildDocument, buildPayment, buildCustomer, decimal } from "@/test-utils/factories";

jest.mock("@/lib/db", () => ({
  db: mockDb,
}));

import { getDashboardData } from "@/services/dashboard.service";

describe("dashboard.service", () => {
  beforeEach(() => {
    resetMockDb();
  });

  it("returns business-scoped dashboard data with the correct filters", async () => {
    mockDb.customer.count.mockResolvedValue(3);
    mockDb.document.count.mockResolvedValue(4);
    mockDb.payment.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal("250") },
    });
    mockDb.document.aggregate.mockResolvedValue({
      _sum: { amountDue: new Prisma.Decimal("125") },
    });
    mockDb.document.findMany
      .mockResolvedValueOnce([
        buildDocument({
          customer: buildCustomer({ fullName: "Dana", companyName: null }),
        }),
      ])
      .mockResolvedValueOnce([
        buildDocument({
          id: "doc-2",
          number: "INV-0002",
          dueDate: new Date("2026-04-01"),
          amountDue: decimal("80"),
          customer: buildCustomer({ fullName: null, companyName: "Acme" }),
        }),
      ]);
    mockDb.payment.findMany.mockResolvedValue([
      buildPayment({
        amount: decimal("250"),
        customer: buildCustomer({ fullName: "Dana", companyName: null }),
      }),
    ]);

    const result = await getDashboardData("biz-1");

    expect(result.kpis).toEqual({
      activeCustomersCount: 3,
      issuedDocumentsCount: 4,
      totalPaidAmount: new Prisma.Decimal("250"),
      totalOpenAmount: new Prisma.Decimal("125"),
    });

    expect(mockDb.customer.count).toHaveBeenCalledWith({
      where: { businessId: "biz-1", isActive: true },
    });
    expect(mockDb.document.count).toHaveBeenCalledWith({
      where: {
        businessId: "biz-1",
        status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] },
      },
    });
    expect(mockDb.document.aggregate).toHaveBeenCalledWith({
      where: {
        businessId: "biz-1",
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        type: { not: "CREDIT_NOTE" },
      },
      _sum: { amountDue: true },
    });
    expect(mockDb.document.findMany).toHaveBeenNthCalledWith(1, {
      where: { businessId: "biz-1" },
      include: {
        customer: {
          select: { fullName: true, companyName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    expect(mockDb.payment.findMany).toHaveBeenCalledWith({
      where: { businessId: "biz-1" },
      include: {
        customer: {
          select: { fullName: true, companyName: true },
        },
        document: {
          select: { id: true, number: true },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: 5,
    });

    const overdueCall = mockDb.document.findMany.mock.calls[1][0];
    expect(overdueCall.where).toEqual({
      businessId: "biz-1",
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      type: { not: "CREDIT_NOTE" },
      dueDate: { lt: expect.any(Date) },
      amountDue: { gt: 0 },
    });
  });
});
