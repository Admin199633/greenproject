"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api-base";
import {
  buildAbsoluteUrl,
  buildPublicDocumentPdfPath,
} from "@/lib/documents/delivery";

interface Props {
  documentId: string;
  publicPdfToken: string;
  approvalUrl?: string | null;
  canCopyApprovalLink?: boolean;
}

export default function DocumentShareActions({
  documentId,
  publicPdfToken,
  approvalUrl,
  canCopyApprovalLink = false,
}: Props) {
  const { toast } = useToast();
  const [approvalLink, setApprovalLink] = useState<string | null>(approvalUrl ?? null);
  const [isCopyingApprovalLink, setIsCopyingApprovalLink] = useState(false);

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

  async function handleCopyApprovalLink() {
    setIsCopyingApprovalLink(true);

    try {
      const url = await getApprovalUrl();

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      toast("קישור הועתק");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "לא ניתן להעתיק את קישור האישור";
      toast(message, "error");
    } finally {
      setIsCopyingApprovalLink(false);
    }
  }

  return (
    <>
      {canCopyApprovalLink && (
        <button
          type="button"
          onClick={() => {
            void handleCopyApprovalLink();
          }}
          disabled={isCopyingApprovalLink}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8 sm:w-auto sm:px-3"
        >
          {isCopyingApprovalLink ? "מעתיק..." : "העתק קישור אישור"}
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
