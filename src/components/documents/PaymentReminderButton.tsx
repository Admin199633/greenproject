"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api-base";

interface Props {
  documentId: string;
  hasCustomerEmail: boolean;
}

export default function PaymentReminderButton({
  documentId,
  hasCustomerEmail,
}: Props) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!hasCustomerEmail || isPending) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/documents/${documentId}/payment-reminder`,
          { method: "POST" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg =
            (data as { error?: string }).error ?? "Failed to send reminder";
          toast(msg, "error");
          return;
        }
        toast("Reminder sent to customer");
      } catch {
        toast("Failed to send reminder", "error");
      }
    });
  }

  const disabled = !hasCustomerEmail || isPending;
  const title = !hasCustomerEmail ? "Customer email is missing" : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      aria-label="Send Reminder"
      className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 h-8 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? "Sending..." : "Send Reminder"}
    </button>
  );
}
