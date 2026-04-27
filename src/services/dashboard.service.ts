import { db } from "@/lib/db";
import { perf } from "@/lib/perf";

const ISSUED_DOCUMENT_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID"] as const;
const OPEN_DOCUMENT_STATUSES = ["ISSUED", "PARTIALLY_PAID"] as const;

export async function getDashboardData(businessId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    activeCustomersCount,
    issuedDocumentsCount,
    paidAmountAggregate,
    openAmountAggregate,
    recentDocuments,
    recentPayments,
    overdueDocuments,
  ] = await perf("dashboard.getDashboardData (7 queries)", () => Promise.all([
    db.customer.count({
      where: {
        businessId,
        isActive: true,
      },
    }),
    db.document.count({
      where: {
        businessId,
        status: { in: [...ISSUED_DOCUMENT_STATUSES] },
      },
    }),
    db.payment.aggregate({
      where: { businessId },
      _sum: { amount: true },
    }),
    db.document.aggregate({
      where: {
        businessId,
        status: { in: [...OPEN_DOCUMENT_STATUSES] },
        type: { not: "CREDIT_NOTE" },
      },
      _sum: { amountDue: true },
    }),
    db.document.findMany({
      where: { businessId },
      include: {
        customer: {
          select: { fullName: true, companyName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.payment.findMany({
      where: { businessId },
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
    }),
    db.document.findMany({
      where: {
        businessId,
        status: { in: [...OPEN_DOCUMENT_STATUSES] },
        type: { not: "CREDIT_NOTE" },
        dueDate: { lt: today },
        amountDue: { gt: 0 },
      },
      include: {
        customer: {
          select: { fullName: true, companyName: true },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]));

  return {
    kpis: {
      activeCustomersCount,
      issuedDocumentsCount,
      totalPaidAmount: paidAmountAggregate._sum.amount ?? 0,
      totalOpenAmount: openAmountAggregate._sum.amountDue ?? 0,
    },
    recentDocuments,
    recentPayments,
    overdueDocuments,
  };
}
