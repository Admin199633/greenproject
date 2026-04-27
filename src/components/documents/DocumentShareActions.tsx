"use client";

import SendDocumentButton from "@/components/documents/SendDocumentButton";
import { useToast } from "@/components/ui/Toast";
import {
  buildAbsoluteUrl,
  buildWhatsappMessage,
  buildWhatsappShareUrl,
} from "@/lib/documents/delivery";
import { buildPublicDocumentPdfPath } from "@/lib/documents/public-pdf";

interface Props {
  documentId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  documentType: string;
  documentNumber: string;
  issuedHash: string;
  totalAmountFormatted: string;
}

function WhatsappIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-5 w-5 shrink-0"
      fill="currentColor"
    >
      <path d="M19.11 17.29c-.29-.14-1.72-.85-1.99-.95-.27-.1-.46-.14-.66.14-.19.29-.76.95-.93 1.14-.17.19-.34.22-.63.07-.29-.14-1.21-.45-2.31-1.45-.85-.75-1.43-1.68-1.6-1.97-.17-.29-.02-.45.13-.59.13-.13.29-.34.43-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.66-1.58-.9-2.17-.24-.57-.49-.49-.66-.5h-.56c-.19 0-.5.07-.76.36-.26.29-.99.96-.99 2.35 0 1.38 1.01 2.72 1.15 2.91.14.19 1.98 3.02 4.8 4.23.67.29 1.2.46 1.61.59.68.22 1.29.19 1.77.12.54-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.33Z" />
      <path d="M27.23 4.76A15.82 15.82 0 0 0 16.01 0C7.19 0 .01 7.18.01 16c0 2.82.74 5.58 2.13 8L0 32l8.22-2.12A15.91 15.91 0 0 0 16 32c8.82 0 16-7.18 16-16 0-4.27-1.66-8.29-4.77-11.24ZM16 29.3c-2.39 0-4.73-.64-6.78-1.86l-.49-.29-4.88 1.26 1.3-4.76-.32-.49A13.24 13.24 0 0 1 2.72 16C2.72 8.68 8.68 2.72 16 2.72S29.28 8.68 29.28 16 23.32 29.3 16 29.3Z" />
    </svg>
  );
}

export default function DocumentShareActions({
  documentId,
  customerName,
  customerEmail,
  customerPhone,
  documentType,
  documentNumber,
  issuedHash,
  totalAmountFormatted,
}: Props) {
  const { toast } = useToast();

  async function handleWhatsappShare() {
    const pdfUrl = buildAbsoluteUrl(
      buildPublicDocumentPdfPath(documentId, issuedHash),
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
      window.open(
        buildWhatsappShareUrl(customerPhone, message),
        "_blank",
        "noopener,noreferrer"
      );
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
        href={buildAbsoluteUrl(
          buildPublicDocumentPdfPath(documentId, issuedHash),
          typeof window === "undefined" ? undefined : window.location.origin
        )}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:min-h-8 sm:w-auto sm:px-3"
      >
        הורדת PDF
      </a>
      <SendDocumentButton
        documentId={documentId}
        customerEmail={customerEmail}
        className="sm:w-auto"
      />
      <button
        onClick={() => {
          void handleWhatsappShare().catch(() => {
            toast("שגיאה בשיתוף ב-WhatsApp", "error");
          });
        }}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#16a34a] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#15803d] sm:min-h-8 sm:w-auto sm:px-4"
      >
        <WhatsappIcon />
        <span>שליחה בוואטסאפ</span>
      </button>
    </>
  );
}
