"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  paymentId: string;
}

export default function DeletePaymentButton({ paymentId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("למחוק תשלום זה? הסטטוס של המסמך יעודכן בהתאם.")) return;

    startTransition(async () => {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "שגיאה במחיקת התשלום");
      }
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
    >
      {isPending ? "מוחק..." : "מחק"}
    </button>
  );
}
