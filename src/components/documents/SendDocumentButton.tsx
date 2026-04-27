"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api-base";
import { cn } from "@/lib/utils";

interface Props {
  documentId: string;
  customerEmail?: string | null;
  className?: string;
}

export default function SendDocumentButton({
  documentId,
  customerEmail,
  className,
}: Props) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSend() {
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/documents/${documentId}/send`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast(data.error ?? "שגיאה בשליחת האימייל", "error");
      } else {
        const recipients = Array.isArray(data.to) ? data.to.join(", ") : "";
        toast(
          recipients ? `האימייל נשלח אל ${recipients}` : "האימייל נשלח בהצלחה"
        );
      }
    } catch {
      toast("שגיאת רשת - נסה שוב", "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={isLoading || !customerEmail}
      title={!customerEmail ? "ללקוח אין כתובת אימייל" : undefined}
      className={cn(
        "inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8 sm:w-auto sm:px-3",
        className
      )}
    >
      {isLoading ? "שולח..." : "שליחה במייל"}
    </button>
  );
}
