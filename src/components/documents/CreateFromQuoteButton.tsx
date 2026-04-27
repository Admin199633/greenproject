"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api-base";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface Props {
  documentId: string;
  targetType: "INVOICE" | "RECEIPT" | "INVOICE_RECEIPT";
  label: string;
  className?: string;
}

export default function CreateFromQuoteButton({
  documentId,
  targetType,
  label,
  className,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/documents/${documentId}/create-from-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast((data as { error?: string }).error ?? "שגיאה ביצירת המסמך", "error");
        return;
      }

      const createdId = (data as { id?: string }).id;
      if (!createdId) {
        toast("שגיאה ביצירת המסמך", "error");
        return;
      }

      router.push(`/documents/${createdId}/edit`);
      router.refresh();
    } catch {
      toast("שגיאת רשת - נסה שוב", "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8 sm:w-auto sm:px-3",
        className
      )}
    >
      {isLoading ? "יוצר..." : label}
    </button>
  );
}
