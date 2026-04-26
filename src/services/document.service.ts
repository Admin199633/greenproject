import { createHash } from "crypto";
import { DocumentStatus, DocumentType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SaveDraftInput } from "@/lib/validations/document";

// ─── Number formatting ────────────────────────────────────────────────────────

const DEFAULT_NUMBER_PREFIX: Record<DocumentType, string> = {
  QUOTE: "QUO-",
  INVOICE: "INV-",
  RECEIPT: "REC-",
  INVOICE_RECEIPT: "INVR-",
  CREDIT_NOTE: "CN-",
};

function getDocumentPrefix(
  type: DocumentType,
  business: {
    invoiceNumberPrefix?: string | null;
    receiptNumberPrefix?: string | null;
    quoteNumberPrefix?: string | null;
    invoiceReceiptNumberPrefix?: string | null;
  }
): string {
  switch (type) {
    case DocumentType.INVOICE:
      return business.invoiceNumberPrefix || DEFAULT_NUMBER_PREFIX.INVOICE;
    case DocumentType.RECEIPT:
      return business.receiptNumberPrefix || DEFAULT_NUMBER_PREFIX.RECEIPT;
    case DocumentType.QUOTE:
      return business.quoteNumberPrefix || DEFAULT_NUMBER_PREFIX.QUOTE;
    case DocumentType.INVOICE_RECEIPT:
      return business.invoiceReceiptNumberPrefix || DEFAULT_NUMBER_PREFIX.INVOICE_RECEIPT;
    case DocumentType.CREDIT_NOTE:
      return DEFAULT_NUMBER_PREFIX.CREDIT_NOTE;
  }
}

function formatDocumentNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Snapshot-safe display name: "CompanyName — FullName" or whichever is set. */
function snapshotCustomerName(
  customer: { fullName: string | null; companyName: string | null }
): string {
  const { fullName, companyName } = customer;
  if (companyName && fullName) return `${companyName} — ${fullName}`;
  return companyName || fullName || "";
}

// ─── Issued document hash ─────────────────────────────────────────────────────

/**
 * Compute a stable SHA256 hash for an issued document.
 *
 * Only immutable issued-document data is included — the hash reflects the
 * document exactly as it was issued and must never be recomputed after issue.
 * Decimal values are serialised as strings to avoid floating-point ambiguity.
 */
function computeIssuedDocumentHash(params: {
  type: string;
  number: string;
  issueDate: Date;
  dueDate: Date | null;
  customerName: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  customerTaxId: string | null;
  businessName: string | null;
  businessTaxId: string | null;
  businessAddress: string | null;
  items: Array<{
    lineIndex: number;
    description: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    subtotalAmount: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
  }>;
  subtotalAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}): string {
  const canonical = {
    type: params.type,
    number: params.number,
    issueDate: params.issueDate.toISOString(),
    dueDate: params.dueDate ? params.dueDate.toISOString() : null,
    customer: {
      name: params.customerName,
      email: params.customerEmail,
      address: params.customerAddress,
      taxId: params.customerTaxId,
    },
    business: {
      name: params.businessName,
      taxId: params.businessTaxId,
      address: params.businessAddress,
    },
    items: params.items.map((item) => ({
      lineIndex: item.lineIndex,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      discountAmount: item.discountAmount.toString(),
      subtotalAmount: item.subtotalAmount.toString(),
      taxRate: item.taxRate.toString(),
      taxAmount: item.taxAmount.toString(),
      totalAmount: item.totalAmount.toString(),
    })),
    totals: {
      subtotalAmount: params.subtotalAmount.toString(),
      taxAmount: params.taxAmount.toString(),
      totalAmount: params.totalAmount.toString(),
    },
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListDocumentsFilters {
  type?: string;
  customerId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

const CREDIT_NOTE_SOURCE_TYPES = new Set<DocumentType>([
  DocumentType.INVOICE,
  DocumentType.INVOICE_RECEIPT,
]);

const CREDIT_NOTE_SOURCE_STATUSES = new Set<DocumentStatus>([
  DocumentStatus.ISSUED,
  DocumentStatus.PARTIALLY_PAID,
  DocumentStatus.PAID,
]);

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listDocuments(
  businessId: string,
  filters: ListDocumentsFilters = {}
) {
  const { type, customerId, status, dateFrom, dateTo, search } = filters;

  return db.document.findMany({
    where: {
      businessId,
      // Exclude soft-deleted documents from all list views
      status: status
        ? (status as DocumentStatus)
        : { not: DocumentStatus.DELETED },
      ...(type ? { type: type as DocumentType } : {}),
      ...(customerId ? { customerId } : {}),
      ...(dateFrom || dateTo
        ? {
            issueDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(search?.trim()
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              {
                customer: {
                  fullName: { contains: search, mode: "insensitive" },
                },
              },
              {
                customer: {
                  companyName: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      customer: {
        select: { id: true, fullName: true, companyName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDocumentById(id: string, businessId: string) {
  return db.document.findFirst({
    where: { id, businessId, status: { not: DocumentStatus.DELETED } },
    include: {
      customer: true,
      sourceDocument: {
        select: { id: true, number: true, type: true, status: true },
      },
      creditNote: {
        select: { id: true, number: true, type: true, status: true },
      },
      items: { orderBy: { lineIndex: "asc" } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createDraft(
  businessId: string,
  data: SaveDraftInput
) {
  return db.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        businessId,
        customerId: data.customerId,
        type: data.type as DocumentType,
        status: "DRAFT",
        number: null,
        issueDate: data.issueDate ? new Date(data.issueDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes?.trim() || null,
        internalNotes: data.internalNotes?.trim() || null,
        currency: data.currency,
        isTaxInclusive: data.isTaxInclusive,
        vatRateSnapshot: String(data.vatRateSnapshot),
        subtotalAmount: data.subtotalAmount,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        amountPaid: "0",
        amountDue: data.amountDue,
        // Photography quote fields
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        eventLocation: data.eventLocation?.trim() || null,
        eventHours: data.eventHours != null ? String(data.eventHours) : null,
        eventTime: data.eventTime?.trim() || null,
        // Snapshot fields are null for drafts — populated at issue time (Phase 3B)
        customerName: null,
        customerEmail: null,
        customerAddress: null,
        customerTaxId: null,
        businessName: null,
        businessTaxId: null,
        businessAddress: null,
      },
    });

    await tx.documentItem.createMany({
      data: data.items.map((item) => ({
        documentId: doc.id,
        lineIndex: item.lineIndex,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        subtotalAmount: item.subtotalAmount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
      })),
    });

    return doc;
  });
}

export async function updateDraft(
  id: string,
  businessId: string,
  data: SaveDraftInput
) {
  const existing = await db.document.findFirst({
    where: { id, businessId },
    select: {
      status: true,
      type: true,
      sourceDocumentId: true,
      customerId: true,
    },
  });
  if (!existing) throw new Error("Document not found");
  if (existing.status !== "DRAFT")
    throw new Error(`IMMUTABLE:Document status is ${existing.status} — only DRAFT documents can be edited`);
  if (existing.sourceDocumentId && data.type !== "CREDIT_NOTE") {
    throw new Error("Credit note type cannot be changed");
  }
  if (existing.sourceDocumentId && data.customerId !== existing.customerId) {
    throw new Error("Credit note customer cannot be changed");
  }

  return db.$transaction(async (tx) => {
    // Replace all items atomically
    await tx.documentItem.deleteMany({ where: { documentId: id } });

    await tx.document.update({
      where: { id },
      data: {
        customerId: data.customerId,
        type: data.type as DocumentType,
        issueDate: data.issueDate ? new Date(data.issueDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes?.trim() || null,
        internalNotes: data.internalNotes?.trim() || null,
        currency: data.currency,
        isTaxInclusive: data.isTaxInclusive,
        vatRateSnapshot: String(data.vatRateSnapshot),
        subtotalAmount: data.subtotalAmount,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        amountDue: data.amountDue,
        // Photography quote fields
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        eventLocation: data.eventLocation?.trim() || null,
        eventHours: data.eventHours != null ? String(data.eventHours) : null,
        eventTime: data.eventTime?.trim() || null,
      },
    });

    await tx.documentItem.createMany({
      data: data.items.map((item) => ({
        documentId: id,
        lineIndex: item.lineIndex,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        subtotalAmount: item.subtotalAmount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
      })),
    });
  });
}

export async function deleteDraft(id: string, businessId: string) {
  const existing = await db.document.findFirst({ where: { id, businessId } });
  if (!existing) throw new Error("Document not found");
  if (existing.status !== "DRAFT")
    throw new Error(`IMMUTABLE:Document status is ${existing.status} — only DRAFT documents can be deleted`);

  // Soft-delete: mark as DELETED so historical data is preserved.
  await db.document.update({ where: { id }, data: { status: "DELETED" } });
}

export async function issueDraft(id: string, businessId: string) {
  // Load document + customer + items together; verify ownership in the same query
  const doc = await db.document.findFirst({
    where: { id, businessId },
    include: { customer: true, items: { orderBy: { lineIndex: "asc" } } },
  });
  if (!doc) throw new Error("Document not found");
  if (doc.status !== "DRAFT") throw new Error("Only drafts can be issued");

  // Load business for snapshot (already verified above via businessId)
  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  // ── Required fields validation (Task 4) ──────────────────────────────────
  const validationErrors: string[] = [];

  if (!business.name?.trim()) {
    validationErrors.push("שם העסק חסר — עדכן בהגדרות העסק");
  }
  if (!business.taxId?.trim()) {
    validationErrors.push("מספר עוסק / ח.פ חסר — עדכן בהגדרות העסק");
  }
  if (!doc.issueDate) {
    validationErrors.push("תאריך המסמך חסר");
  }
  if (doc.items.length === 0) {
    validationErrors.push("המסמך חייב לכלול לפחות פריט אחד");
  }

  // ── VAT rule (Task 2.2): authorized business must have VAT on invoices ────
  const isAuthorizedBusiness =
    business.taxType === "osek_murshe" || business.taxType === "chevra";
  const isInvoiceType =
    doc.type === DocumentType.INVOICE ||
    doc.type === DocumentType.INVOICE_RECEIPT;
  if (isAuthorizedBusiness && isInvoiceType && Number(doc.vatRateSnapshot) <= 0) {
    validationErrors.push(
      "עסק מורשה (עוסק מורשה / חברה) חייב לכלול מע״מ בחשבונית — בדוק את שיעור המע״מ בהגדרות העסק"
    );
  }

  if (validationErrors.length > 0) {
    throw new Error(`VALIDATION:${validationErrors.join(" | ")}`);
  }

  try {
    return await db.$transaction(async (tx) => {
      // 1. Re-check status inside the transaction to prevent double-issue race condition.
      const locked = await tx.document.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      if (locked.status !== "DRAFT") throw new Error("Only drafts can be issued");

      // 2. Atomically assign the next sequential number for this type.
      const counter = await tx.documentCounter.upsert({
        where: { businessId_type: { businessId, type: doc.type } },
        create: { businessId, type: doc.type, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const number = formatDocumentNumber(
        getDocumentPrefix(doc.type, business),
        counter.lastNumber
      );

      // 3. Resolve snapshot values that will be stored.
      const finalIssueDate = doc.issueDate ?? new Date();
      const finalCustomerName = doc.customerName ?? snapshotCustomerName(doc.customer);
      const finalCustomerEmail = doc.customerEmail ?? doc.customer.email;
      const finalCustomerAddress = doc.customerAddress ?? doc.customer.address;
      const finalCustomerTaxId = doc.customerTaxId ?? doc.customer.taxId;
      const finalBusinessName = doc.businessName ?? business.name;
      const finalBusinessTaxId = doc.businessTaxId ?? business.taxId;
      const finalBusinessAddress = doc.businessAddress ?? business.address;

      // 4. Compute SHA256 hash over the immutable issued-document data.
      const issuedHash = computeIssuedDocumentHash({
        type: doc.type,
        number,
        issueDate: finalIssueDate,
        dueDate: doc.dueDate,
        customerName: finalCustomerName,
        customerEmail: finalCustomerEmail,
        customerAddress: finalCustomerAddress,
        customerTaxId: finalCustomerTaxId,
        businessName: finalBusinessName,
        businessTaxId: finalBusinessTaxId,
        businessAddress: finalBusinessAddress,
        items: doc.items,
        subtotalAmount: doc.subtotalAmount,
        taxAmount: doc.taxAmount,
        totalAmount: doc.totalAmount,
      });

      // 5. Transition to ISSUED, populate snapshot fields, and store the hash.
      return tx.document.update({
        where: { id },
        data: {
          status: "ISSUED",
          number,
          issueDate: finalIssueDate,
          customerName: finalCustomerName,
          customerEmail: finalCustomerEmail,
          customerAddress: finalCustomerAddress,
          customerTaxId: finalCustomerTaxId,
          businessName: finalBusinessName,
          businessTaxId: finalBusinessTaxId,
          businessAddress: finalBusinessAddress,
          issuedHash,
        },
      });
    });
  } catch (error) {
    // Unique constraint violation — duplicate document number.
    // This should never happen in normal flow (counter is atomic), but acts
    // as a last-resort safety net against data corruption or manual DB edits.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("NUMBERING_CONFLICT:Document number already exists — issue aborted");
    }
    throw error;
  }
}

export async function cancelDocument(id: string, businessId: string) {
  const doc = await db.document.findFirst({
    where: { id, businessId },
    select: { status: true, amountPaid: true },
  });

  if (!doc) throw new Error("Document not found");
  if (doc.status === "DRAFT") throw new Error("Draft documents cannot be cancelled");
  if (doc.status === "PARTIALLY_PAID") throw new Error("Partially paid documents cannot be cancelled");
  if (doc.status === "PAID") throw new Error("Paid documents cannot be cancelled");
  if (doc.status === "CANCELLED") throw new Error("Document is already cancelled");
  if (doc.status !== "ISSUED") throw new Error("Only issued documents can be cancelled");
  if (doc.amountPaid.gt(0)) throw new Error("Documents with payments cannot be cancelled");

  return db.$transaction(async (tx) => {
    const locked = await tx.document.findUniqueOrThrow({
      where: { id },
      select: { status: true, amountPaid: true },
    });

    if (locked.status === "DRAFT") throw new Error("Draft documents cannot be cancelled");
    if (locked.status === "PARTIALLY_PAID") throw new Error("Partially paid documents cannot be cancelled");
    if (locked.status === "PAID") throw new Error("Paid documents cannot be cancelled");
    if (locked.status === "CANCELLED") throw new Error("Document is already cancelled");
    if (locked.status !== "ISSUED") throw new Error("Only issued documents can be cancelled");
    if (locked.amountPaid.gt(0)) throw new Error("Documents with payments cannot be cancelled");

    return tx.document.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  });
}

export async function duplicateDocument(id: string, businessId: string) {
  const source = await db.document.findFirst({
    where: { id, businessId },
    include: { items: { orderBy: { lineIndex: "asc" } } },
  });

  if (!source) throw new Error("Document not found");

  // Recalculate totals by summing item values
  const subtotalAmount = source.items.reduce(
    (sum, item) => sum.plus(item.subtotalAmount),
    new Prisma.Decimal(0)
  );
  const taxAmount = source.items.reduce(
    (sum, item) => sum.plus(item.taxAmount),
    new Prisma.Decimal(0)
  );
  const totalAmount = source.items.reduce(
    (sum, item) => sum.plus(item.totalAmount),
    new Prisma.Decimal(0)
  );

  return db.$transaction(async (tx) => {
    const draft = await tx.document.create({
      data: {
        businessId,
        customerId: source.customerId,
        type: source.type,
        status: DocumentStatus.DRAFT,
        number: null,
        issueDate: null,
        dueDate: source.dueDate,
        notes: source.notes,
        internalNotes: source.internalNotes,
        currency: source.currency,
        isTaxInclusive: source.isTaxInclusive,
        vatRateSnapshot: source.vatRateSnapshot,
        subtotalAmount,
        taxAmount,
        totalAmount,
        amountPaid: "0",
        amountDue: totalAmount,
        customerName: null,
        customerEmail: null,
        customerAddress: null,
        customerTaxId: null,
        businessName: null,
        businessTaxId: null,
        businessAddress: null,
      },
    });

    await tx.documentItem.createMany({
      data: source.items.map((item) => ({
        documentId: draft.id,
        lineIndex: item.lineIndex,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        subtotalAmount: item.subtotalAmount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
      })),
    });

    return draft;
  });
}

export async function createCreditNoteFromDocument(
  id: string,
  businessId: string
) {
  const source = await db.document.findFirst({
    where: { id, businessId },
    include: {
      items: { orderBy: { lineIndex: "asc" } },
      creditNote: { select: { id: true } },
    },
  });

  if (!source) throw new Error("Document not found");
  if (!CREDIT_NOTE_SOURCE_TYPES.has(source.type)) {
    throw new Error("Document type cannot be credited");
  }
  if (!CREDIT_NOTE_SOURCE_STATUSES.has(source.status)) {
    throw new Error("Only issued documents can create a credit note");
  }
  if (source.creditNote) {
    throw new Error("Credit note already exists for this document");
  }

  try {
    return db.$transaction(async (tx) => {
      const locked = await tx.document.findUniqueOrThrow({
        where: { id },
        include: {
          items: { orderBy: { lineIndex: "asc" } },
          creditNote: { select: { id: true } },
        },
      });

      if (locked.businessId !== businessId) throw new Error("Document not found");
      if (!CREDIT_NOTE_SOURCE_TYPES.has(locked.type)) {
        throw new Error("Document type cannot be credited");
      }
      if (!CREDIT_NOTE_SOURCE_STATUSES.has(locked.status)) {
        throw new Error("Only issued documents can create a credit note");
      }
      if (locked.creditNote) {
        throw new Error("Credit note already exists for this document");
      }

      const creditNote = await tx.document.create({
        data: {
          businessId,
          customerId: locked.customerId,
          sourceDocumentId: locked.id,
          type: DocumentType.CREDIT_NOTE,
          status: DocumentStatus.DRAFT,
          number: null,
          issueDate: null,
          dueDate: null,
          notes: locked.notes,
          internalNotes: locked.internalNotes,
          currency: locked.currency,
          isTaxInclusive: locked.isTaxInclusive,
          vatRateSnapshot: locked.vatRateSnapshot,
          subtotalAmount: locked.subtotalAmount,
          taxAmount: locked.taxAmount,
          totalAmount: locked.totalAmount,
          amountPaid: "0",
          amountDue: locked.totalAmount,
          customerName: locked.customerName,
          customerEmail: locked.customerEmail,
          customerAddress: locked.customerAddress,
          customerTaxId: locked.customerTaxId,
          businessName: locked.businessName,
          businessTaxId: locked.businessTaxId,
          businessAddress: locked.businessAddress,
        },
      });

      await tx.documentItem.createMany({
        data: locked.items.map((item) => ({
          documentId: creditNote.id,
          lineIndex: item.lineIndex,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          subtotalAmount: item.subtotalAmount,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          totalAmount: item.totalAmount,
        })),
      });

      return creditNote;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Credit note already exists for this document");
    }

    throw error;
  }
}
