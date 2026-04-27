"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { API_BASE } from "@/lib/api-base";
import { cn } from "@/lib/utils";

interface Props {
  documentId: string;
  className?: string;
}

export default function CreateCreditNoteButton({
  documentId,
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    if (!confirm("ליצור מסמך זיכוי על בסיס המסמך הזה?")) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const res = await fetch(`${API_BASE}/documents/${documentId}/credit-note`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "שגיאה ביצירת הזיכוי");
        return;
      }

      const data = await res.json();
      router.push(`/documents/${data.id}/edit`);
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-col items-end gap-1 w-full sm:w-auto", className)}>
      <Button
        variant="outline"
        size="sm"
        className="min-h-[44px] w-full sm:min-h-8 sm:w-auto"
        onClick={handleCreate}
        disabled={isPending}
      >
        {isPending ? "יוצר..." : "צור זיכוי"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
