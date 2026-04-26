import { Prisma } from "@prisma/client";

export function decimal(value: string | number) {
  return new Prisma.Decimal(value);
}

export function buildCustomer(overrides?: {
  fullName?: string | null;
  companyName?: string | null;
}) {
  return {
    fullName: overrides?.fullName ?? "Dana Levi",
    companyName: overrides?.companyName ?? null,
  };
}

export function buildDocument(overrides?: Record<string, unknown>) {
  return {
    id: "doc-1",
    status: "ISSUED",
    type: "INVOICE",
    amountDue: decimal("100"),
    amountPaid: decimal("0"),
    totalAmount: decimal("100"),
    number: "INV-0001",
    issueDate: new Date("2026-04-09T00:00:00.000Z"),
    dueDate: new Date("2026-04-20T00:00:00.000Z"),
    createdAt: new Date("2026-04-09T00:00:00.000Z"),
    customer: buildCustomer(),
    ...overrides,
  };
}

export function buildPayment(overrides?: Record<string, unknown>) {
  return {
    id: "pay-1",
    amount: decimal("30"),
    paymentDate: new Date("2026-04-09T00:00:00.000Z"),
    customer: buildCustomer(),
    document: { id: "doc-1", number: "INV-0001" },
    ...overrides,
  };
}
