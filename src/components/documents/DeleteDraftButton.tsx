"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { API_BASE } from "@/lib/api-base";
import { cn } from "@/lib/utils";

export default function DeleteDraftButton({
  documentId,
  className,
}: {
  documentId: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("האם למחוק טיוטה זו?\nפעולה זו בלתי הפיכה.")) {
      return;
    }

    startTransition(async () => {
      const res = await fetch(`${API_BASE}/documents/${documentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/documents");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error ?? "שגיאה במחיקה");
      }
    });
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      className={cn("min-h-[44px] w-full sm:min-h-8 sm:w-auto", className)}
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "מוחק..." : "מחק טיוטה"}
    </Button>
  );
}
