"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api-base";

interface Props {
  documentId: string;
}

export default function SendDocumentButton({ documentId }: Props) {
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
      disabled={isLoading}
      className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? "שולח..." : "שליחה במייל"}
    </button>
  );
}
