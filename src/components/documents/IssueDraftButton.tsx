"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api-base";

interface Props {
  documentId: string;
}

export default function IssueDraftButton({ documentId }: Props) {
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
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleIssue}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? "מנפיק..." : "הנפק"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
