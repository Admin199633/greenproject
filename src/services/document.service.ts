import { createHash } from "crypto";
import { DocumentStatus, DocumentType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { perf } from "@/lib/perf";
import {
  buildApprovalUrl,
  generateApprovalToken,
  hashApprovalToken,
} from "@/lib/documents/approval";
import type { SaveDraftInput } from "@/lib/validations/document";
import { createCalendarEventForBusiness } from "@/services/google-calendar.service";
import { formatCurrency, formatDate, formatEventTime } from "@/lib/utils";
import {
  buildOwnerApprovalRedirectWhatsappMessage,
  buildWhatsappShareUrl,
} from "@/lib/documents/delivery";
import {
  DEFAULT_DOCUMENT_START_NUMBER,
  normalizeBusinessNumbering,
} from "@/lib/validations/business";

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

const CREDIT_NOTE_NUMBER_PREFIX = "CN-";
const CANCELLABLE_DOCUMENT_TYPES = new Set<DocumentType>([
  DocumentType.QUOTE,
  DocumentType.RECEIPT,
  DocumentType.INVOICE,
  DocumentType.INVOICE_RECEIPT,
]);
const CANCELLABLE_DOCUMENT_STATUSES = new Set<DocumentStatus>([
  DocumentStatus.ISSUED,
  DocumentStatus.PARTIALLY_PAID,
  DocumentStatus.PAID,
]);

type BusinessNumberingSettings = {
  invoiceNumberPrefix?: string | null;
  invoiceStartNumber?: number | null;
  receiptNumberPrefix?: string | null;
  receiptStartNumber?: number | null;
  quoteNumberPrefix?: string | null;
  quoteStartNumber?: number | null;
  invoiceReceiptNumberPrefix?: string | null;
  invoiceReceiptStartNumber?: number | null;
};

function getDocumentNumbering(
  type: DocumentType,
  business: BusinessNumberingSettings
) {
  const numbering = normalizeBusinessNumbering(business);

  switch (type) {
    case DocumentType.INVOICE:
      return {
        prefix: numbering.invoiceNumberPrefix,
        startNumber: numbering.invoiceStartNumber,
      };
    case DocumentType.RECEIPT:
      return {
        prefix: numbering.receiptNumberPrefix,
        startNumber: numbering.receiptStartNumber,
      };
    case DocumentType.QUOTE:
      return {
        prefix: numbering.quoteNumberPrefix,
        startNumber: numbering.quoteStartNumber,
      };
    case DocumentType.INVOICE_RECEIPT:
      return {
        prefix: numbering.invoiceReceiptNumberPrefix,
        startNumber: numbering.invoiceReceiptStartNumber,
      };
    case DocumentType.CREDIT_NOTE:
      return {
        prefix: CREDIT_NOTE_NUMBER_PREFIX,
        startNumber: DEFAULT_DOCUMENT_START_NUMBER,
      };
  }
}

function formatDocumentNumber(prefix: string, n: number) {
  return prefix ? `${prefix}${String(n).padStart(4, "0")}` : String(n);
}

function assertDocumentCanBeCancelled(document: {
  type: DocumentType;
  status: DocumentStatus;
}) {
  if (!CANCELLABLE_DOCUMENT_TYPES.has(document.type)) {
    throw new Error("Document type cannot be cancelled");
  }
  if (document.status === DocumentStatus.DRAFT) {
    throw new Error("Draft documents cannot be cancelled");
  }
  if (document.status === DocumentStatus.CANCELLED) {
    throw new Error("Document is already cancelled");
  }
  if (!CANCELLABLE_DOCUMENT_STATUSES.has(document.status)) {
    throw new Error("Only issued documents can be cancelled");
  }
}

function getNextNumberFromStart(startNumber: number) {
  return startNumber + 1;
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
          select: {
            id: true,
            fullName: true,
            companyName: true,
            email: true,
          },
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

      const numbering = getDocumentNumbering(doc.type, business);
      const counter = await tx.documentCounter.upsert({
        where: { businessId_type: { businessId, type: doc.type } },
        create: {
          businessId,
          type: doc.type,
          lastNumber: getNextNumberFromStart(numbering.startNumber),
        },
        update: { lastNumber: { increment: 1 } },
      });

      let issuedNumber = counter.lastNumber;
      const minimumNextNumber = getNextNumberFromStart(numbering.startNumber);
      if (issuedNumber < minimumNextNumber) {
        const correctedCounter = await tx.documentCounter.update({
          where: { businessId_type: { businessId, type: doc.type } },
          data: { lastNumber: minimumNextNumber },
        });
        issuedNumber = correctedCounter.lastNumber;
      }

      const number = formatDocumentNumber(numbering.prefix, issuedNumber);

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
    select: { type: true, status: true },
  });

  if (!doc) throw new Error("Document not found");
  assertDocumentCanBeCancelled(doc);

  return db.$transaction(async (tx) => {
    const locked = await tx.document.findUniqueOrThrow({
      where: { id },
      select: { businessId: true, type: true, status: true },
    });

    if (locked.businessId !== businessId) throw new Error("Document not found");
    assertDocumentCanBeCancelled(locked);

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
    select: { type: true, status: true },
  });

  if (!source) throw new Error("Document not found");
  if (source.type !== DocumentType.QUOTE) {
    throw new Error("Only quotes can create follow-up documents");
  }
  if (source.status !== DocumentStatus.ISSUED) {
    throw new Error("Only issued quotes can create follow-up documents");
  }

  return db.$transaction(async (tx) => {
    const locked = await tx.document.findUniqueOrThrow({
      where: { id },
      include: {
        items: { orderBy: { lineIndex: "asc" } },
      },
    });

    if (locked.businessId !== businessId) throw new Error("Document not found");
    if (locked.type !== DocumentType.QUOTE) {
      throw new Error("Only quotes can create follow-up documents");
    }
    if (locked.status !== DocumentStatus.ISSUED) {
      throw new Error("Only issued quotes can create follow-up documents");
    }

    const draft = await tx.document.create({
      data: {
        businessId,
        customerId: locked.customerId,
        type: targetType,
        status: DocumentStatus.DRAFT,
        number: null,
        issueDate: new Date(),
        dueDate: targetType === "RECEIPT" ? new Date() : locked.dueDate,
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
        eventDate: locked.eventDate,
        eventLocation: locked.eventLocation,
        eventHours: locked.eventHours,
        eventTime: locked.eventTime,
        receiptAmountReceived:
          targetType === "RECEIPT" || targetType === "INVOICE_RECEIPT"
            ? locked.totalAmount
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
      data: locked.items.map((item) => ({
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

/**
 * Mint a new customer-approval token for an issued QUOTE.
 *
 * Stores only the SHA-256 hash; the raw token is returned and is the only
 * place the raw value ever leaves the server (it is then placed inside the
 * customer-facing approval URL by callers).
 *
 * Refuses to mint if the document is not a QUOTE, is not ISSUED, or has
 * already been approved.
 */
export async function mintQuoteApprovalToken(
  documentId: string,
  businessId: string
): Promise<{ rawToken: string }> {
  const doc = await db.document.findFirst({
    where: { id: documentId, businessId },
    select: {
      id: true,
      type: true,
      status: true,
      approvedAt: true,
    },
  });

  if (!doc) throw new Error("Document not found");
  if (doc.type !== DocumentType.QUOTE) {
    throw new Error("APPROVAL:Only quotes support customer approval");
  }
  if (doc.status !== DocumentStatus.ISSUED) {
    throw new Error("APPROVAL:Only issued quotes can have an approval link");
  }
  if (doc.approvedAt) {
    throw new Error("APPROVAL:Quote is already approved");
  }

  const { rawToken, tokenHash } = generateApprovalToken();
  const now = new Date();

  await db.document.update({
    where: { id: documentId },
    data: {
      approvalTokenHash: tokenHash,
      approvalTokenCreatedAt: now,
      approvalTokenExpiresAt: null,
    },
  });

  return { rawToken };
}

/**
 * Look up an issued QUOTE by its raw approval token. Returns `null` for any
 * mismatch (no document, wrong type, wrong status, expired token, etc.) so
 * callers cannot distinguish reasons for failure.
 */
export async function findQuoteByApprovalToken(rawToken: string) {
  const trimmed = rawToken.trim();
  if (!trimmed) return null;

  const tokenHash = hashApprovalToken(trimmed);

  const doc = await db.document.findFirst({
    where: {
      approvalTokenHash: tokenHash,
      type: DocumentType.QUOTE,
      status: DocumentStatus.ISSUED,
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          taxId: true,
          address: true,
          city: true,
          postalCode: true,
          country: true,
          phone: true,
          email: true,
          logo: true,
        },
      },
      customer: true,
      items: { orderBy: { lineIndex: "asc" } },
    },
  });

  if (!doc) return null;

  if (doc.approvalTokenExpiresAt && doc.approvalTokenExpiresAt < new Date()) {
    return null;
  }

  return doc;
}

export interface RecordApprovalInput {
  approvedByName: string;
  approvalIp?: string | null;
  approvalUserAgent?: string | null;
  approvalSignatureDataUrl?: string | null;
}

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function buildCalendarEventTimes(params: {
  eventDate: Date;
  eventTime: string | null;
  eventHours: Prisma.Decimal | null;
}): { startISO: string; endISO: string } | null {
  const date = params.eventDate;
  if (!date || Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  let hours = 9;
  let minutes = 0;
  const timeMatch = params.eventTime?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const parsedHours = Number(timeMatch[1]);
    const parsedMinutes = Number(timeMatch[2]);
    if (
      Number.isInteger(parsedHours) &&
      parsedHours >= 0 &&
      parsedHours <= 23 &&
      Number.isInteger(parsedMinutes) &&
      parsedMinutes >= 0 &&
      parsedMinutes <= 59
    ) {
      hours = parsedHours;
      minutes = parsedMinutes;
    }
  }

  const startMs = Date.UTC(year, month, day, hours, minutes, 0);
  const durationHours =
    params.eventHours && Number(params.eventHours) > 0
      ? Number(params.eventHours)
      : 3;
  const endMs = startMs + Math.round(durationHours * 3600 * 1000);

  function format(ms: number) {
    const d = new Date(ms);
    return (
      `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
      `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00`
    );
  }

  return { startISO: format(startMs), endISO: format(endMs) };
}

async function tryCreateOwnerCalendarEvent(
  documentId: string,
  rawToken: string | null
): Promise<boolean> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      businessId: true,
      number: true,
      currency: true,
      totalAmount: true,
      eventDate: true,
      eventTime: true,
      eventHours: true,
      eventLocation: true,
      customerName: true,
      googleCalendarEventId: true,
      customer: {
        select: {
          fullName: true,
          companyName: true,
          phone: true,
        },
      },
    },
  });

  if (!doc) return false;
  if (doc.googleCalendarEventId) return false;
  if (!doc.eventDate) return false;

  // No event time configured — skip calendar creation rather than guess a time.
  if (!doc.eventTime?.trim()) {
    console.error(
      "[calendar] create event skipped — no eventTime on document",
      doc.id
    );
    return false;
  }

  const times = buildCalendarEventTimes({
    eventDate: doc.eventDate,
    eventTime: doc.eventTime ?? null,
    eventHours: doc.eventHours ?? null,
  });
  if (!times) return false;

  const customerName =
    doc.customerName?.trim() ||
    doc.customer.companyName?.trim() ||
    doc.customer.fullName?.trim() ||
    "לקוח/ה";
  const customerPhone = doc.customer.phone?.trim() ?? null;
  const quoteNumber = doc.number ?? "";
  const totalFormatted = formatCurrency(doc.totalAmount.toString());
  const approvalLink = rawToken ? buildApprovalUrl(rawToken) : "";

  const summary = `צילום אירוע - ${customerName}`;
  const descriptionLines: Array<string | null> = [
    "הצעת מחיר אושרה ✅",
    "",
    `לקוח: ${customerName}`,
    customerPhone ? `טלפון: ${customerPhone}` : null,
    quoteNumber ? `מספר הצעה: ${quoteNumber}` : null,
    `סה"כ: ${totalFormatted}`,
  ];
  if (approvalLink) {
    descriptionLines.push("", "קישור להצעה:", approvalLink);
  }
  const description = descriptionLines
    .filter((line): line is string => line !== null)
    .join("\n");

  try {
    const result = await createCalendarEventForBusiness(doc.businessId, {
      summary,
      description,
      location: doc.eventLocation?.trim() || null,
      startISO: times.startISO,
      endISO: times.endISO,
      timeZone: "Asia/Jerusalem",
    });
    if (!result) return false;

    await db.document.update({
      where: { id: doc.id },
      data: { googleCalendarEventId: result.eventId },
    });
    return true;
  } catch (error) {
    console.error("[calendar] create event failed", error);
    return false;
  }
}

export async function recordQuoteApproval(
  rawToken: string,
  input: RecordApprovalInput
) {
  const trimmed = rawToken.trim();
  if (!trimmed) {
    throw new Error("APPROVAL:Invalid token");
  }

  const tokenHash = hashApprovalToken(trimmed);
  const approvedByName = input.approvedByName.trim();
  const approvalSignatureDataUrl = input.approvalSignatureDataUrl?.trim() || null;
  if (!approvedByName) {
    throw new Error("APPROVAL:Approver name is required");
  }

  const updated = await db.$transaction(async (tx) => {
    const doc = await tx.document.findFirst({
      where: {
        approvalTokenHash: tokenHash,
        type: DocumentType.QUOTE,
        status: DocumentStatus.ISSUED,
      },
      select: {
        id: true,
        approvedAt: true,
        approvalTokenExpiresAt: true,
      },
    });

    if (!doc) {
      throw new Error("APPROVAL:Invalid token");
    }
    if (doc.approvalTokenExpiresAt && doc.approvalTokenExpiresAt < new Date()) {
      throw new Error("APPROVAL:Invalid token");
    }
    if (doc.approvedAt) {
      throw new Error("APPROVAL:Already approved");
    }

    return tx.document.update({
      where: { id: doc.id },
      data: {
        approvedAt: new Date(),
        approvedByName,
        approvalIp: input.approvalIp?.trim() || null,
        approvalUserAgent: input.approvalUserAgent?.slice(0, 500) || null,
        approvalSignatureDataUrl,
        approvalTermsAccepted: true,
      },
      select: {
        id: true,
        approvedAt: true,
        approvedByName: true,
        approvalSignatureDataUrl: true,
      },
    });
  });

  // After-the-fact: try to create an owner-side Google Calendar event.
  // Approval succeeds whether or not this works. The raw token is held in
  // memory only; we never read it back from the DB (we only store its hash).
  let calendarEventCreated = false;
  try {
    calendarEventCreated = await tryCreateOwnerCalendarEvent(updated.id, trimmed);
  } catch (error) {
    console.error("[calendar] create event failed", error);
  }

  // Build a wa.me redirect URL that opens a chat with the business owner with
  // a pre-filled Hebrew approval message. Returns null if the business has no
  // phone configured — the route then keeps the existing success response.
  const whatsappRedirectUrl = await buildOwnerApprovalWhatsappRedirectUrl(
    updated.id
  );

  return { ...updated, calendarEventCreated, whatsappRedirectUrl };
}

async function buildOwnerApprovalWhatsappRedirectUrl(
  documentId: string
): Promise<string | null> {
  try {
    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: {
        customerName: true,
        eventDate: true,
        eventTime: true,
        business: { select: { phone: true } },
        customer: {
          select: {
            fullName: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });

    const businessPhone = doc?.business.phone?.trim();
    if (!doc || !businessPhone) return null;

    const customerName =
      doc.customerName?.trim() ||
      doc.customer.companyName?.trim() ||
      doc.customer.fullName?.trim() ||
      "";
    const customerPhone = doc.customer.phone?.trim() ?? null;
    const eventDate = doc.eventDate ? formatDate(doc.eventDate) : null;
    const eventTime = formatEventTime(doc.eventTime) || doc.eventTime || null;

    const message = buildOwnerApprovalRedirectWhatsappMessage({
      customerName,
      customerPhone,
      eventDate,
      eventTime,
    });
    return buildWhatsappShareUrl(businessPhone, message);
  } catch (error) {
    console.error("[approval] build whatsapp redirect failed", error);
    return null;
  }
}

export { buildApprovalUrl };
