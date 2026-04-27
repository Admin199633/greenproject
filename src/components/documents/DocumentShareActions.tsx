"use client";

import SendDocumentButton from "@/components/documents/SendDocumentButton";
import { useToast } from "@/components/ui/Toast";
import {
  buildAbsoluteUrl,
  buildDocumentPdfPath,
  buildWhatsappMessage,
  buildWhatsappShareUrl,
} from "@/lib/documents/delivery";

interface Props {
  documentId: string;
  customerName: string;
  customerPhone: string | null;
  documentType: string;
  documentNumber: string;
  totalAmountFormatted: string;
}

export default function DocumentShareActions({
  documentId,
  customerName,
  customerPhone,
  documentType,
  documentNumber,
  totalAmountFormatted,
}: Props) {
  const { toast } = useToast();

  async function handleWhatsappShare() {
    const pdfUrl = buildAbsoluteUrl(
      buildDocumentPdfPath(documentId),
      window.location.origin
    );
    const message = buildWhatsappMessage({
      customerName,
      type: documentType,
      documentNumber,
      totalAmount: totalAmountFormatted,
      pdfUrl,
    });

    if (customerPhone?.trim()) {
      window.open(buildWhatsappShareUrl(customerPhone, message), "_blank", "noopener,noreferrer");
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      toast("הודעת הוואטסאפ הועתקה ללוח");
      return;
    }

    if (navigator.share) {
      await navigator.share({ text: message });
      return;
    }

    toast("לא ניתן לשתף ללא מספר טלפון", "error");
  }

  return (
    <>
      <a
        href={buildDocumentPdfPath(documentId)}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
      >
        הורדת PDF
      </a>
      <SendDocumentButton documentId={documentId} />
      <button
        onClick={() => {
          void handleWhatsappShare().catch(() => {
            toast("שגיאה בשיתוף ב-WhatsApp", "error");
          });
        }}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
      >
        שליחה ב-WhatsApp
      </button>
    </>
  );
}
