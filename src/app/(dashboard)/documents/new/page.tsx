import { requireBusiness } from "@/services/auth.service";
import { listSavedItems } from "@/services/savedItem.service";
import DocumentForm from "@/components/documents/DocumentForm";

export default async function NewDocumentPage() {
  const business = await requireBusiness();
  const savedItems = await listSavedItems(business.id);

  const defaultVatRate =
    business.taxType === "osek_patur"
      ? "0"
      : String(Number(business.vatRate));

  return (
    <div className="max-w-4xl mx-auto space-y-1">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-800">מסמך חדש</h2>
        <p className="text-sm text-slate-500 mt-0.5">יוצר כטיוטה — ניתן להנפיק בהמשך</p>
      </div>
      <DocumentForm
        mode="create"
        savedItems={savedItems.map((i) => ({ ...i, defaultPrice: i.defaultPrice.toString() }))}
        businessType={business.businessType ?? "general"}
        isExempt={business.taxType === "osek_patur"}
        defaultValues={{ vatRateSnapshot: defaultVatRate }}
      />
    </div>
  );
}
