import { notFound, redirect } from "next/navigation";
import { requireBusiness } from "@/services/auth.service";
import { getDisplayName } from "@/services/customer.service";
import { listSavedItems } from "@/services/savedItem.service";
import { getBusiness } from "@/services/business.service";
import { db } from "@/lib/db";
import DocumentForm, {
  type DocumentFormDefaults,
} from "@/components/documents/DocumentForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDocumentPage({ params }: PageProps) {
  const { id } = await params;
  const business = await requireBusiness();

  const [doc, savedItems, fullBusiness] = await Promise.all([
    db.document.findFirst({
      where: {
        id,
        businessId: business.id,
        status: { not: "DELETED" },
      },
      select: {
        id: true,
        status: true,
        type: true,
        issueDate: true,
        dueDate: true,
        notes: true,
        internalNotes: true,
        currency: true,
        isTaxInclusive: true,
        vatRateSnapshot: true,
        eventDate: true,
        eventLocation: true,
        eventHours: true,
        eventTime: true,
        receiptAmountReceived: true,
        receiptPaymentMethod: true,
        receiptPaymentReference: true,
        receiptCheckNumber: true,
        receiptCheckBank: true,
        receiptCheckBranch: true,
        receiptCheckAccount: true,
        receiptCheckDueDate: true,
        customer: {
          select: {
            fullName: true,
            companyName: true,
            phone: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            discountAmount: true,
          },
          orderBy: { lineIndex: "asc" },
        },
      },
    }),
    listSavedItems(business.id),
    getBusiness(business.id),
  ]);

  if (!doc) notFound();
  // Only drafts are editable
  if (doc.status !== "DRAFT") redirect(`/documents/${id}`);

  const defaults: DocumentFormDefaults = {
    type: doc.type,
    customerName: doc.customer.fullName ?? doc.customer.companyName ?? "",
    customerPhone: doc.customer.phone ?? "",
    customerEmail: doc.customer.email ?? "",
    issueDate: doc.issueDate
      ? doc.issueDate.toISOString().slice(0, 10)
      : "",
    dueDate: doc.dueDate ? doc.dueDate.toISOString().slice(0, 10) : "",
    notes: doc.notes ?? "",
    internalNotes: doc.internalNotes ?? "",
    currency: doc.currency,
    isTaxInclusive: doc.isTaxInclusive,
    vatRateSnapshot: doc.vatRateSnapshot.toString(),
    items: doc.items.map((item) => ({
      key: item.id,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      discountAmount: item.discountAmount.toString(),
    })),
    eventDate: doc.eventDate ? doc.eventDate.toISOString().slice(0, 10) : "",
    eventLocation: doc.eventLocation ?? "",
    eventHours: doc.eventHours ? doc.eventHours.toString() : "",
    eventTime: doc.eventTime ?? "",
    receiptAmountReceived: doc.receiptAmountReceived
      ? doc.receiptAmountReceived.toString()
      : "",
    receiptPaymentMethod: (doc.receiptPaymentMethod as DocumentFormDefaults["receiptPaymentMethod"]) ?? undefined,
    receiptPaymentReference: doc.receiptPaymentReference ?? "",
    receiptCheckNumber: doc.receiptCheckNumber ?? "",
    receiptCheckBank: doc.receiptCheckBank ?? "",
    receiptCheckBranch: doc.receiptCheckBranch ?? "",
    receiptCheckAccount: doc.receiptCheckAccount ?? "",
    receiptCheckDueDate: doc.receiptCheckDueDate
      ? doc.receiptCheckDueDate.toISOString().slice(0, 10)
      : "",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-1">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-800">עריכת טיוטה</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {getDisplayName(doc.customer)}
        </p>
      </div>
      <DocumentForm
        mode="edit"
        documentId={doc.id}
        savedItems={savedItems.map((i) => ({ ...i, defaultPrice: i.defaultPrice.toString() }))}
        businessType={fullBusiness?.businessType ?? "general"}
        isExempt={fullBusiness?.taxType === "osek_patur"}
        defaultValues={defaults}
      />
    </div>
  );
}
