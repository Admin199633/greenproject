"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  documentId: string;
  customerEmail: string | null | undefined;
}

export default function SendDocumentButton({ documentId, customerEmail }: Props) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSend() {
    setIsLoading(true);

    try {
      const res = await fetch(`/api/documents/${documentId}/send`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast(data.error ?? "שגיאה בשליחת האימייל", "error");
      } else {
        toast(`האימייל נשלח אל ${data.to}`);
      }
    } catch {
      toast("שגיאת רשת — נסה שוב", "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={isLoading || !customerEmail}
      title={!customerEmail ? "ללקוח אין כתובת אימייל" : undefined}
      className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? "שולח..." : "שלח באימייל"}
    </button>
  );
}
