import { DocumentStatus, DocumentType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CreatePaymentInput } from "@/lib/validations/payment";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Re-computes amountPaid, amountDue, and status for a document based on its
 * current payments. Called inside a transaction after every payment mutation.
 */
async function recalculateDocumentStatus(
  tx: Prisma.TransactionClient,
  documentId: string
): Promise<void> {
  const [aggregate, doc] = await Promise.all([
    tx.payment.aggregate({
      where: { documentId },
      _sum: { amount: true },
    }),
    tx.document.findUniqueOrThrow({
      where: { id: documentId },
      select: { totalAmount: true },
    }),
  ]);

  const rawPaid = aggregate._sum.amount ?? new Prisma.Decimal(0);
  const totalAmount = doc.totalAmount;

  // Clamp: payments can never exceed total (defensive — protects against DB inconsistency)
  const amountPaid = Prisma.Decimal.min(rawPaid, totalAmount);
  const amountDue = Prisma.Decimal.max(
    totalAmount.sub(amountPaid),
    new Prisma.Decimal(0)
  );

  let status: DocumentStatus;
  if (totalAmount.isZero() || amountPaid.isZero()) {
    // Zero-value document or no payments yet → stay at ISSUED
    status = "ISSUED";
  } else if (amountPaid.lessThan(totalAmount)) {
    status = "PARTIALLY_PAID";
  } else {
    status = "PAID";
  }

  await tx.document.update({
    where: { id: documentId },
    data: { amountPaid, amountDue, status },
  });
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export interface ListPaymentsFilters {
  method?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
}

export async function listPayments(
  businessId: string,
  filters: ListPaymentsFilters = {}
) {
  const { method, dateFrom, dateTo, customerId } = filters;
  return db.payment.findMany({
    where: {
      businessId,
      ...(method ? { method } : {}),
      ...(customerId ? { customerId } : {}),
      ...(dateFrom || dateTo
        ? {
            paymentDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      document: { select: { id: true, number: true, type: true } },
      customer: { select: { id: true, fullName: true, companyName: true } },
    },
    orderBy: { paymentDate: "desc" },
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createPayment(
  businessId: string,
  userId: string,
  data: CreatePaymentInput
) {
  // Verify document exists, belongs to this business, and is eligible
  const doc = await db.document.findFirst({
    where: { id: data.documentId, businessId },
  });
  if (!doc) throw new Error("Document not found");
  if (doc.status === "DRAFT") throw new Error("Cannot add payment to a draft document");
  if (doc.type === DocumentType.QUOTE) throw new Error("Quotes cannot receive payments");
  if (doc.type === DocumentType.CREDIT_NOTE) throw new Error("Credit notes cannot receive payments");
  if (doc.status === "CANCELLED") throw new Error("Cannot add payment to a cancelled document");
  if (doc.status === "PAID") throw new Error("Document is already fully paid");
  if (doc.amountDue.lte(0)) throw new Error("Document has no outstanding balance");

  const paymentAmount = new Prisma.Decimal(data.amount);
  if (paymentAmount.greaterThan(doc.amountDue)) {
    throw new Error("Payment amount exceeds remaining balance");
  }

  return db.$transaction(async (tx) => {
    // Re-read inside transaction — authoritative check against race conditions
    const lockedDoc = await tx.document.findUniqueOrThrow({
      where: { id: data.documentId },
      select: { amountDue: true, customerId: true, status: true },
    });
    if (lockedDoc.status === "CANCELLED") throw new Error("Cannot add payment to a cancelled document");
    if (lockedDoc.amountDue.lte(0)) throw new Error("Document has no outstanding balance");
    if (paymentAmount.greaterThan(lockedDoc.amountDue)) {
      throw new Error("Payment amount exceeds remaining balance");
    }

    // Idempotency: reject an identical payment submitted within the last 60 seconds
    const recentDuplicate = await tx.payment.findFirst({
      where: {
        documentId: data.documentId,
        amount: data.amount,
        method: data.method,
        reference: data.reference?.trim() || null,
        paymentDate: new Date(data.paymentDate),
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recentDuplicate) throw new Error("Duplicate payment detected — please wait before retrying");

    const payment = await tx.payment.create({
      data: {
        businessId,
        documentId: data.documentId,
        customerId: lockedDoc.customerId,
        createdByUserId: userId,
        amount: data.amount,
        paymentDate: new Date(data.paymentDate),
        method: data.method,
        reference: data.reference?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    await recalculateDocumentStatus(tx, data.documentId);

    return payment;
  });
}

export async function deletePayment(id: string, businessId: string) {
  const payment = await db.payment.findFirst({
    where: { id, businessId },
  });
  if (!payment) throw new Error("Payment not found");

  const { documentId } = payment;

  await db.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id } });
    await recalculateDocumentStatus(tx, documentId);
  });

  // Return payment snapshot for audit logging
  return payment;
}
