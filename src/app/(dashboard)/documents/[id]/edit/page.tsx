import { notFound, redirect } from "next/navigation";
import { requireBusiness } from "@/services/auth.service";
import { getDocumentById } from "@/services/document.service";
import { getDisplayName } from "@/services/customer.service";
import { listSavedItems } from "@/services/savedItem.service";
import { getBusiness } from "@/services/business.service";
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
    getDocumentById(id, business.id),
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
