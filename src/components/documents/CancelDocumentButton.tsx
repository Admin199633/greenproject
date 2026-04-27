"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api-base";
import { cn } from "@/lib/utils";

interface Props {
  documentId: string;
  className?: string;
}

export default function CancelDocumentButton({
  documentId,
  className,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    if (!confirm("לבטל את המסמך? לאחר הביטול לא ניתן יהיה לשנות אותו.")) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const res = await fetch(`${API_BASE}/documents/${documentId}/cancel`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? "שגיאה בביטול המסמך";
        setError(msg);
        toast(msg, "error");
        return;
      }

      toast("המסמך בוטל בהצלחה");
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-col items-end gap-1 w-full sm:w-auto", className)}>
      <Button
        variant="destructive"
        size="sm"
        className="min-h-[44px] w-full sm:min-h-8 sm:w-auto"
        onClick={handleCancel}
        disabled={isPending}
      >
        {isPending ? "מבטל..." : "בטל מסמך"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
