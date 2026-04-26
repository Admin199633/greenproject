"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Props {
  documentId: string;
}

export default function CreateCreditNoteButton({ documentId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    if (!confirm("ליצור מסמך זיכוי על בסיס המסמך הזה?")) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const res = await fetch(`/api/documents/${documentId}/credit-note`, {
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
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleCreate} disabled={isPending}>
        {isPending ? "יוצר..." : "צור זיכוי"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
