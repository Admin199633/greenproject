import { createHash } from "crypto";
import { DocumentStatus, DocumentType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { perf } from "@/lib/perf";
import type { SaveDraftInput } from "@/lib/validations/document";

type Tx = Prisma.TransactionClient;

async function resolveCustomer(
  tx: Tx,
  businessId: string,
  input: { customerName: string; customerPhone: string; customerEmail?: string }
) {
  const phone = input.customerPhone.trim();
  const email = input.customerEmail?.trim() || null;
  const name = input.customerName.trim();

  const existing = await tx.customer.findFirst({
    where: { businessId, phone },
  });

  if (existing) {
    const updates: { fullName?: string; email?: string } = {};
    if (name) updates.fullName = name;
    if (email) updates.email = email;
    if (Object.keys(updates).length === 0) return existing;
    return tx.customer.update({ where: { id: existing.id }, data: updates });
  }

  return tx.customer.create({
    data: {
      businessId,
      fullName: name,
      phone,
      email,
    },
  });
}

function isReceiptType(type: DocumentType | string) {
  return type === DocumentType.RECEIPT || type === DocumentType.INVOICE_RECEIPT;
}

function snapshotCustomerName(customer: {
  fullName: string | null;
  companyName: string | null;
}) {
  if (customer.companyName && customer.fullName) {
    return `${customer.companyName} - ${customer.fullName}`;
  }
  return customer.companyName || customer.fullName || "";
}

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
) {
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

function formatDocumentNumber(prefix: string, n: number) {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

function buildReceiptDraftData(data: SaveDraftInput) {
  return {
    receiptAmountReceived: data.receiptAmountReceived || null,
    receiptPaymentMethod: data.receiptPaymentMethod ?? null,
    receiptPaymentReference: data.receiptPaymentReference?.trim() || null,
    receiptCheckNumber: data.receiptCheckNumber?.trim() || null,
    receiptCheckBank: data.receiptCheckBank?.trim() || null,
    receiptCheckBranch: data.receiptCheckBranch?.trim() || null,
    receiptCheckAccount: data.receiptCheckAccount?.trim() || null,
    receiptCheckDueDate: data.receiptCheckDueDate
      ? new Date(data.receiptCheckDueDate)
      : null,
  };
}

function buildDocumentItemsData(
  documentId: string,
  items: SaveDraftInput["items"]
) {
  return items.map((item) => ({
    documentId,
    lineIndex: item.lineIndex,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountAmount: item.discountAmount,
    subtotalAmount: item.subtotalAmount,
    taxRate: item.taxRate,
    taxAmount: item.taxAmount,
    totalAmount: item.totalAmount,
  }));
}

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
  receiptAmountReceived?: Prisma.Decimal | null;
  receiptPaymentMethod?: string | null;
  receiptPaymentReference?: string | null;
  receiptCheckNumber?: string | null;
  receiptCheckBank?: string | null;
  receiptCheckBranch?: string | null;
  receiptCheckAccount?: string | null;
  receiptCheckDueDate?: Date | null;
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
}) {
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
    receipt: {
      amountReceived: params.receiptAmountReceived?.toString() ?? null,
      paymentMethod: params.receiptPaymentMethod ?? null,
      paymentReference: params.receiptPaymentReference ?? null,
      checkNumber: params.receiptCheckNumber ?? null,
      checkBank: params.receiptCheckBank ?? null,
      checkBranch: params.receiptCheckBranch ?? null,
      checkAccount: params.receiptCheckAccount ?? null,
      checkDueDate: params.receiptCheckDueDate?.toISOString() ?? null,
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

export async function listDocuments(
  businessId: string,
  filters: ListDocumentsFilters = {}
) {
  const { type, customerId, status, dateFrom, dateTo, search } = filters;

  return perf("document.listDocuments", () =>
    db.document.findMany({
      where: {
        businessId,
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
    })
  );
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

export async function createDraft(businessId: string, data: SaveDraftInput) {
  return db.$transaction(async (tx) => {
    const customer = await resolveCustomer(tx, businessId, data);

    let quoteTermsSnapshot: string | null = null;
    if (data.type === DocumentType.QUOTE) {
      const business = await tx.business.findUnique({
        where: { id: businessId },
        select: { quoteTermsText: true },
      });
      quoteTermsSnapshot = business?.quoteTermsText?.trim() || null;
    }

    const doc = await tx.document.create({
      data: {
        businessId,
        customerId: customer.id,
        type: data.type as DocumentType,
        status: DocumentStatus.DRAFT,
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
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        eventLocation: data.eventLocation?.trim() || null,
        eventHours: data.eventHours != null ? String(data.eventHours) : null,
        eventTime: data.eventTime?.trim() || null,
        quoteTermsText: quoteTermsSnapshot,
        ...buildReceiptDraftData(data),
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
      data: buildDocumentItemsData(doc.id, data.items),
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
  if (existing.status !== "DRAFT") {
    throw new Error(
      `IMMUTABLE:Document status is ${existing.status} ג€” only DRAFT documents can be edited`
    );
  }
  if (existing.sourceDocumentId && data.type !== "CREDIT_NOTE") {
    throw new Error("Credit note type cannot be changed");
  }

  return db.$transaction(async (tx) => {
    const customer = await resolveCustomer(tx, businessId, data);
    if (existing.sourceDocumentId && customer.id !== existing.customerId) {
      throw new Error("Credit note customer cannot be changed");
    }

    await tx.documentItem.deleteMany({ where: { documentId: id } });

    await tx.document.update({
      where: { id },
      data: {
        customerId: customer.id,
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
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        eventLocation: data.eventLocation?.trim() || null,
        eventHours: data.eventHours != null ? String(data.eventHours) : null,
        eventTime: data.eventTime?.trim() || null,
        ...buildReceiptDraftData(data),
      },
    });

    await tx.documentItem.createMany({
      data: buildDocumentItemsData(id, data.items),
    });
  });
}

export async function deleteDraft(id: string, businessId: string) {
  const existing = await db.document.findFirst({ where: { id, businessId } });
  if (!existing) throw new Error("Document not found");
  if (existing.status !== "DRAFT") {
    throw new Error(
      `IMMUTABLE:Document status is ${existing.status} ג€” only DRAFT documents can be deleted`
    );
  }

  await db.document.update({ where: { id }, data: { status: "DELETED" } });
}

export async function issueDraft(
  id: string,
  businessId: string,
  createdByUserId: string
) {
  const doc = await db.document.findFirst({
    where: { id, businessId },
    include: { customer: true, items: { orderBy: { lineIndex: "asc" } } },
  });
  if (!doc) throw new Error("Document not found");
  if (doc.status !== "DRAFT") throw new Error("Only drafts can be issued");

  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  const validationErrors: string[] = [];

  if (!business.name?.trim()) {
    validationErrors.push("שם העסק חסר - עדכן בהגדרות העסק");
  }
  if (!business.taxId?.trim()) {
    validationErrors.push("מספר עוסק / ח.פ חסר - עדכן בהגדרות העסק");
  }
  if (!doc.issueDate) {
    validationErrors.push("תאריך המסמך חסר");
  }
  if (doc.items.length === 0) {
    validationErrors.push("המסמך חייב לכלול לפחות פריט אחד");
  }

  const isAuthorizedBusiness =
    business.taxType === "osek_murshe" || business.taxType === "chevra";
  const isInvoiceType =
    doc.type === DocumentType.INVOICE ||
    doc.type === DocumentType.INVOICE_RECEIPT;
  if (isAuthorizedBusiness && isInvoiceType && Number(doc.vatRateSnapshot) <= 0) {
    validationErrors.push(
      'עסק מורשה (עוסק מורשה / חברה) חייב לכלול מע"מ בחשבונית - בדוק את שיעור המע"מ בהגדרות העסק'
    );
  }

  if (isReceiptType(doc.type)) {
    const receiptAmount = doc.receiptAmountReceived
      ? new Prisma.Decimal(doc.receiptAmountReceived)
      : null;

    if (!receiptAmount || receiptAmount.lte(0)) {
      validationErrors.push("בקבלה חייבים להזין סכום שהתקבל");
    }
    if (!doc.receiptPaymentMethod?.trim()) {
      validationErrors.push("בקבלה חייבים לבחור אמצעי תשלום");
    }
    if (receiptAmount && receiptAmount.greaterThan(doc.totalAmount)) {
      validationErrors.push("סכום שהתקבל לא יכול לעלות על סכום המסמך");
    }
  }

  if (validationErrors.length > 0) {
    throw new Error(`VALIDATION:${validationErrors.join(" | ")}`);
  }

  try {
    return await db.$transaction(async (tx) => {
      const locked = await tx.document.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      if (locked.status !== "DRAFT") throw new Error("Only drafts can be issued");

      const counter = await tx.documentCounter.upsert({
        where: { businessId_type: { businessId, type: doc.type } },
        create: { businessId, type: doc.type, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const number = formatDocumentNumber(
        getDocumentPrefix(doc.type, business),
        counter.lastNumber
      );

      const finalIssueDate = doc.issueDate ?? new Date();
      const finalCustomerName = doc.customerName ?? snapshotCustomerName(doc.customer);
      const finalCustomerEmail = doc.customerEmail ?? doc.customer.email;
      const finalCustomerAddress = doc.customerAddress ?? doc.customer.address;
      const finalCustomerTaxId = doc.customerTaxId ?? doc.customer.taxId;
      const finalBusinessName = doc.businessName ?? business.name;
      const finalBusinessTaxId = doc.businessTaxId ?? business.taxId;
      const finalBusinessAddress = doc.businessAddress ?? business.address;

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
        receiptAmountReceived: doc.receiptAmountReceived,
        receiptPaymentMethod: doc.receiptPaymentMethod,
        receiptPaymentReference: doc.receiptPaymentReference,
        receiptCheckNumber: doc.receiptCheckNumber,
        receiptCheckBank: doc.receiptCheckBank,
        receiptCheckBranch: doc.receiptCheckBranch,
        receiptCheckAccount: doc.receiptCheckAccount,
        receiptCheckDueDate: doc.receiptCheckDueDate,
        items: doc.items,
        subtotalAmount: doc.subtotalAmount,
        taxAmount: doc.taxAmount,
        totalAmount: doc.totalAmount,
      });

      const issuedDoc = await tx.document.update({
        where: { id },
        data: {
          status: DocumentStatus.ISSUED,
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

      if (!isReceiptType(doc.type)) {
        return issuedDoc;
      }

      const amountPaid = new Prisma.Decimal(doc.receiptAmountReceived ?? "0");
      const cappedAmountPaid = Prisma.Decimal.min(amountPaid, doc.totalAmount);
      const amountDue = Prisma.Decimal.max(
        doc.totalAmount.sub(cappedAmountPaid),
        new Prisma.Decimal(0)
      );
      const status = cappedAmountPaid.isZero()
        ? DocumentStatus.ISSUED
        : cappedAmountPaid.lessThan(doc.totalAmount)
        ? DocumentStatus.PARTIALLY_PAID
        : DocumentStatus.PAID;

      await tx.payment.create({
        data: {
          businessId,
          documentId: doc.id,
          customerId: doc.customerId,
          createdByUserId,
          amount: cappedAmountPaid,
          paymentDate: finalIssueDate,
          method: doc.receiptPaymentMethod!,
          reference: doc.receiptPaymentReference?.trim() || null,
          checkNumber: doc.receiptCheckNumber?.trim() || null,
          checkBank: doc.receiptCheckBank?.trim() || null,
          checkBranch: doc.receiptCheckBranch?.trim() || null,
          checkAccount: doc.receiptCheckAccount?.trim() || null,
          checkDueDate: doc.receiptCheckDueDate ?? null,
          notes: doc.notes?.trim() || null,
        },
      });

      return tx.document.update({
        where: { id },
        data: {
          amountPaid: cappedAmountPaid,
          amountDue,
          status,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("NUMBERING_CONFLICT:Document number already exists ג€” issue aborted");
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
  if (doc.status === "PARTIALLY_PAID") {
    throw new Error("Partially paid documents cannot be cancelled");
  }
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
    if (locked.status === "PARTIALLY_PAID") {
      throw new Error("Partially paid documents cannot be cancelled");
    }
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
        eventDate: source.eventDate,
        eventLocation: source.eventLocation,
        eventHours: source.eventHours,
        eventTime: source.eventTime,
        receiptAmountReceived: source.receiptAmountReceived,
        receiptPaymentMethod: source.receiptPaymentMethod,
        receiptPaymentReference: source.receiptPaymentReference,
        receiptCheckNumber: source.receiptCheckNumber,
        receiptCheckBank: source.receiptCheckBank,
        receiptCheckBranch: source.receiptCheckBranch,
        receiptCheckAccount: source.receiptCheckAccount,
        receiptCheckDueDate: source.receiptCheckDueDate,
        quoteTermsText: source.quoteTermsText,
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

export async function createDocumentFromQuote(
  id: string,
  businessId: string,
  targetType: "INVOICE" | "RECEIPT" | "INVOICE_RECEIPT"
) {
  const source = await db.document.findFirst({
    where: { id, businessId },
    include: {
      items: { orderBy: { lineIndex: "asc" } },
      customer: true,
    },
  });

  if (!source) throw new Error("Document not found");
  if (source.type !== DocumentType.QUOTE) {
    throw new Error("Only quotes can create follow-up documents");
  }
  if (source.status !== DocumentStatus.ISSUED) {
    throw new Error("Only issued quotes can create follow-up documents");
  }

  return db.$transaction(async (tx) => {
    const draft = await tx.document.create({
      data: {
        businessId,
        customerId: source.customerId,
        type: targetType,
        status: DocumentStatus.DRAFT,
        number: null,
        issueDate: new Date(),
        dueDate: targetType === "RECEIPT" ? new Date() : source.dueDate,
        notes: source.notes,
        internalNotes: source.internalNotes,
        currency: source.currency,
        isTaxInclusive: source.isTaxInclusive,
        vatRateSnapshot: source.vatRateSnapshot,
        subtotalAmount: source.subtotalAmount,
        taxAmount: source.taxAmount,
        totalAmount: source.totalAmount,
        amountPaid: "0",
        amountDue: source.totalAmount,
        eventDate: source.eventDate,
        eventLocation: source.eventLocation,
        eventHours: source.eventHours,
        eventTime: source.eventTime,
        receiptAmountReceived:
          targetType === "RECEIPT" || targetType === "INVOICE_RECEIPT"
            ? source.totalAmount
            : null,
        receiptPaymentMethod: null,
        receiptPaymentReference: null,
        receiptCheckNumber: null,
        receiptCheckBank: null,
        receiptCheckBranch: null,
        receiptCheckAccount: null,
        receiptCheckDueDate: null,
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
