import { requireBusinessId } from "@/services/auth.service";
import { getBusiness } from "@/services/business.service";
import { listSavedItems } from "@/services/savedItem.service";
import { perf } from "@/lib/perf";
import DocumentForm from "@/components/documents/DocumentForm";
import {
  DOCUMENT_TYPES,
  type DocumentTypeValue,
} from "@/lib/validations/document";

// FAB-friendly short slugs → schema enum values. Anything else (or missing)
// falls through to the form's own default (INVOICE).
const TYPE_SLUG_TO_ENUM: Record<string, DocumentTypeValue> = {
  quote: "QUOTE",
  invoice: "INVOICE",
  receipt: "RECEIPT",
  invoice_receipt: "INVOICE_RECEIPT",
  credit_note: "CREDIT_NOTE",
};

function resolveDefaultType(raw?: string): DocumentTypeValue | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower in TYPE_SLUG_TO_ENUM) return TYPE_SLUG_TO_ENUM[lower];
  const upper = raw.toUpperCase();
  if ((DOCUMENT_TYPES as readonly string[]).includes(upper)) {
    return upper as DocumentTypeValue;
  }
  return undefined;
}

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewDocumentPage({ searchParams }: PageProps) {
  const t0 = Date.now();
  const { businessId } = await requireBusinessId();
  const { type: rawType } = await searchParams;
  const defaultType = resolveDefaultType(rawType);

  const [business, savedItems] = await perf("documents/new load total", () =>
    Promise.all([getBusiness(businessId), listSavedItems(businessId)])
  );

  if (!business) {
    return <p className="text-red-600">לא נמצא עסק</p>;
  }

  const defaultVatRate =
    business.taxType === "osek_patur"
      ? "0"
      : String(Number(business.vatRate));

  console.log(`[perf] documents/new page total ${Date.now() - t0}ms`);

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
        defaultValues={{
          vatRateSnapshot: defaultVatRate,
          ...(defaultType ? { type: defaultType } : {}),
        }}
      />
    </div>
  );
}
