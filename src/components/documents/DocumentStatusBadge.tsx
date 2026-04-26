import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  type DocumentTypeValue,
  type DocumentStatusValue,
} from "@/lib/validations/document";

const statusClasses: Record<DocumentStatusValue, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  ISSUED: "bg-blue-50 text-blue-700 border-blue-200",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
};

const typeClasses: Record<DocumentTypeValue, string> = {
  QUOTE: "bg-amber-50 text-amber-700 border-amber-200",
  INVOICE: "bg-violet-50 text-violet-700 border-violet-200",
  RECEIPT: "bg-teal-50 text-teal-700 border-teal-200",
  INVOICE_RECEIPT: "bg-cyan-50 text-cyan-700 border-cyan-200",
  CREDIT_NOTE: "bg-rose-50 text-rose-700 border-rose-200",
};

interface BadgeProps {
  value: string;
  className?: string;
}

function Badge({ value, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {value}
    </span>
  );
}

export function DocumentTypeBadge({ type }: { type: string }) {
  const label = DOCUMENT_TYPE_LABELS[type as DocumentTypeValue] ?? type;
  const cls = typeClasses[type as DocumentTypeValue] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return <Badge value={label} className={cls} />;
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const label = DOCUMENT_STATUS_LABELS[status as DocumentStatusValue] ?? status;
  const cls = statusClasses[status as DocumentStatusValue] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return <Badge value={label} className={cls} />;
}
