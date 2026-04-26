import { Prisma } from "@prisma/client";
import type { Customer } from "@prisma/client";
import { db } from "@/lib/db";
import type { CustomerFormValues } from "@/lib/validations/customer";

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listCustomers(businessId: string, search?: string) {
  return db.customer.findMany({
    where: {
      businessId,
      isActive: true,
      ...(search?.trim()
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomerById(id: string, businessId: string) {
  return db.customer.findFirst({
    where: { id, businessId },
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createCustomer(
  businessId: string,
  data: CustomerFormValues
) {
  return db.customer.create({
    data: {
      businessId,
      fullName: data.fullName?.trim() || null,
      companyName: data.companyName?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      taxId: data.taxId?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
}

export async function updateCustomer(
  id: string,
  businessId: string,
  data: CustomerFormValues
) {
  // Verify ownership before updating
  const existing = await db.customer.findFirst({ where: { id, businessId } });
  if (!existing) throw new Error("Customer not found");

  return db.customer.update({
    where: { id },
    data: {
      fullName: data.fullName?.trim() || null,
      companyName: data.companyName?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      taxId: data.taxId?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
}

export async function deactivateCustomer(id: string, businessId: string) {
  const existing = await db.customer.findFirst({ where: { id, businessId } });
  if (!existing) throw new Error("Customer not found");

  return db.customer.update({
    where: { id },
    data: { isActive: false },
  });
}

// ─── Detail view ─────────────────────────────────────────────────────────────

export async function getCustomerDetail(id: string, businessId: string) {
  const [customer, recentDocuments, recentPayments, openAmountAggregate] =
    await Promise.all([
      db.customer.findFirst({ where: { id, businessId } }),
      db.document.findMany({
        where: { customerId: id, businessId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          totalAmount: true,
          issueDate: true,
        },
      }),
      db.payment.findMany({
        where: { customerId: id, businessId },
        orderBy: { paymentDate: "desc" },
        take: 5,
        select: {
          id: true,
          amount: true,
          method: true,
          paymentDate: true,
          reference: true,
          documentId: true,
        },
      }),
      db.document.aggregate({
        where: {
          customerId: id,
          businessId,
          status: { in: ["ISSUED", "PARTIALLY_PAID"] },
          type: { not: "CREDIT_NOTE" },
        },
        _sum: { amountDue: true },
      }),
    ]);

  return {
    customer,
    recentDocuments,
    recentPayments,
    openAmount: openAmountAggregate._sum.amountDue ?? new Prisma.Decimal(0),
  };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function getDisplayName(
  customer: Pick<Customer, "fullName" | "companyName">
): string {
  const { fullName, companyName } = customer;
  if (companyName && fullName) return `${companyName} — ${fullName}`;
  return companyName || fullName || "—";
}
