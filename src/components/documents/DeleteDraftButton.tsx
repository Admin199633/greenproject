"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function DeleteDraftButton({
  documentId,
}: {
  documentId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        "האם למחוק טיוטה זו?\nפעולה זו בלתי הפיכה."
      )
    )
      return;

    startTransition(async () => {
      const res = await fetch(`/api/documents/${documentId}`, {
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
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "מוחק..." : "מחק טיוטה"}
    </Button>
  );
}
