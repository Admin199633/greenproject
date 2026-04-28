"use client";

import { useEffect, useId, useState } from "react";

type TriggerVariant = "card" | "inline";

interface QuoteTermsModalProps {
  termsText: string;
  triggerVariant: TriggerVariant;
}

export default function QuoteTermsModal({
  termsText,
  triggerVariant,
}: QuoteTermsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!termsText.trim()) {
    return null;
  }

  return (
    <>
      {triggerVariant === "card" ? (
        <section className="rounded-[2rem] border border-[#efe3d8] bg-[linear-gradient(180deg,#fffefc_0%,#fff8f1_100%)] p-5 shadow-[0_20px_70px_rgba(15,23,42,0.06)] ring-1 ring-white/70 sm:p-7">
          <p className="text-[11px] font-medium tracking-[0.22em] text-[#9a7b5c]">
            תנאים והערות
          </p>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">
            תנאים והערות
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            יש לקרוא את התנאים לפני אישור ההצעה
          </p>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-[#d8c3ad] bg-white px-5 text-sm font-semibold text-slate-800 shadow-[0_14px_34px_rgba(182,138,98,0.12)] transition-colors hover:bg-[#fff8f1]"
          >
            צפייה בתנאים
          </button>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="min-h-[44px] shrink-0 rounded-xl px-3 text-sm font-medium text-[#8a6648] underline decoration-[#c9a57e] decoration-2 underline-offset-4 transition-colors hover:text-[#6b4c34]"
        >
          קריאת התנאים
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          dir="rtl"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-[#eadfd3] bg-[#fffdfa] shadow-[0_28px_90px_rgba(15,23,42,0.24)] sm:max-h-[80vh] sm:rounded-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#efe3d8] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h3
                  id={titleId}
                  className="text-lg font-semibold text-slate-900 sm:text-xl"
                >
                  תנאים והערות
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  יש לקרוא את התנאים לפני אישור ההצעה
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[48px] shrink-0 rounded-2xl border border-[#e2d6c9] bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-[#fff6ee]"
              >
                סגור
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              <p className="whitespace-pre-wrap break-words text-sm leading-8 text-slate-700">
                {termsText}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
