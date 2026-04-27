"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api-base";
import { cn } from "@/lib/utils";

interface Props {
  documentId: string;
  className?: string;
}

export default function IssueDraftButton({ documentId, className }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleIssue() {
    if (!confirm("להנפיק מסמך זה? לאחר ההנפקה לא ניתן לערוך או למחוק אותו.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`${API_BASE}/documents/${documentId}/issue`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? "שגיאה בהנפקה";
        setError(msg);
        toast(msg, "error");
        return;
      }
      toast("המסמך הונפק בהצלחה");
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-col items-end gap-1 w-full sm:w-auto", className)}>
      <button
        onClick={handleIssue}
        disabled={isPending}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 sm:min-h-8 sm:w-auto sm:px-3"
      >
        {isPending ? "מנפיק..." : "הנפק"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
