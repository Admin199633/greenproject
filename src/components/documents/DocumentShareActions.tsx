"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api-base";
import {
  buildAbsoluteUrl,
  buildApprovalShareMessage,
  buildPublicDocumentPdfPath,
  buildWhatsappShareUrl,
} from "@/lib/documents/delivery";

interface Props {
  documentId: string;
  customerName: string;
  customerPhone: string | null;
  publicPdfToken: string;
  businessName?: string | null;
  approvalWhatsappMessageTemplate?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  eventLocation?: string | null;
  approvalUrl?: string | null;
  canCopyApprovalLink?: boolean;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function DocumentShareActions({
  documentId,
  customerName,
  customerPhone,
  publicPdfToken,
  businessName,
  approvalWhatsappMessageTemplate,
  eventDate,
  eventTime,
  eventLocation,
  approvalUrl,
  canCopyApprovalLink = false,
}: Props) {
  const { toast } = useToast();
  const [approvalLink, setApprovalLink] = useState<string | null>(approvalUrl ?? null);
  const [isSharingApprovalLink, setIsSharingApprovalLink] = useState(false);

  async function getApprovalUrl() {
    if (approvalLink) {
      return approvalLink;
    }

    const res = await fetch(`${API_BASE}/documents/${documentId}/approval-link`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as {
      approvalUrl?: string;
      error?: string;
    };

    if (!res.ok || !data.approvalUrl) {
      throw new Error(data.error ?? "לא ניתן להפיק קישור אישור");
    }

    setApprovalLink(data.approvalUrl);
    return data.approvalUrl;
  }

  async function handleSendApprovalLink() {
    setIsSharingApprovalLink(true);

    try {
      const url = await getApprovalUrl();
      const message = buildApprovalShareMessage({
        customerName,
        approvalUrl: url,
        businessName,
        eventDate,
        eventTime,
        eventLocation,
        template: approvalWhatsappMessageTemplate,
      });

      const phone = customerPhone?.trim() ?? "";

      if (!phone) {
        await copyTextToClipboard(url);
        toast("אין מספר טלפון ללקוח, הקישור הועתק");
        return;
      }

      const encodedMessage = encodeURIComponent(message);
      const shareUrl = buildWhatsappShareUrl(phone, message);
      console.debug("[whatsapp-share] raw message", message);
      console.debug("[whatsapp-share] encoded message", encodedMessage);
      console.debug("[whatsapp-share] final whatsappUrl", shareUrl);
      console.debug("[whatsapp-share] contains replacement char", {
        rawMessageHasReplacement: message.includes("\uFFFD"),
        encodedMessageHasReplacement: encodedMessage.includes("\uFFFD"),
        whatsappUrlHasReplacement: shareUrl.includes("\uFFFD"),
      });
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "לא ניתן לשלוח את קישור האישור";
      toast(message, "error");
    } finally {
      setIsSharingApprovalLink(false);
    }
  }

  return (
    <>
      {canCopyApprovalLink && (
        <button
          type="button"
          onClick={() => {
            void handleSendApprovalLink();
          }}
          disabled={isSharingApprovalLink}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8 sm:w-auto sm:px-3"
        >
          {isSharingApprovalLink ? "שולח..." : "שלח קישור אישור"}
        </button>
      )}
      <a
        href={buildAbsoluteUrl(
          buildPublicDocumentPdfPath(documentId, publicPdfToken),
          typeof window === "undefined" ? undefined : window.location.origin
        )}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:min-h-8 sm:w-auto sm:px-3"
      >
        הורדת PDF
      </a>
    </>
  );
}
