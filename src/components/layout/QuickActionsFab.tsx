"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

interface QuickAction {
  label: string;
  href: string;
}

interface QuickActionGroup {
  title: string;
  items: QuickAction[];
}

const groups: QuickActionGroup[] = [
  {
    title: "מסמכי הכנסות",
    items: [
      { label: "הצעת מחיר", href: "/documents/new?type=quote" },
      { label: "חשבונית", href: "/documents/new?type=invoice" },
      { label: "קבלה", href: "/documents/new?type=receipt" },
    ],
  },
  {
    title: "מסמכי ניהול שוטף",
    items: [
      { label: "תעודת משלוח", href: "/documents/new?type=delivery" },
    ],
  },
];

export default function QuickActionsFab() {
  const [open, setOpen] = useState(false);
  const sheetTitleId = useId();

  // Lock background scroll while the sheet is open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="פעולות מהירות"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed bottom-4 end-4 sm:bottom-6 sm:end-6 z-40 h-14 w-14 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 flex items-center justify-center text-3xl leading-none active:scale-95 hover:bg-brand-700 transition-transform"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <span aria-hidden="true">+</span>
      </button>

      {/* Backdrop + sheet — kept mounted so we can animate both directions. */}
      <div
        className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="סגור"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Sheet */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={sheetTitleId}
          className={`absolute inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:translate-x-[-50%] sm:max-w-md sm:w-full sm:rounded-2xl rounded-t-2xl bg-white shadow-2xl transform transition-transform duration-200 ease-out ${
            open
              ? "translate-y-0 sm:translate-y-[-50%]"
              : "translate-y-full sm:translate-y-[calc(-50%+1rem)] sm:opacity-0"
          }`}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
        >
          {/* Drag handle (mobile only) */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="h-1.5 w-10 rounded-full bg-slate-200" />
          </div>

          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2
              id={sheetTitleId}
              className="text-lg font-semibold text-slate-800"
            >
              פעולה מהירה
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגור"
              className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="px-3 pb-4 sm:pb-5 space-y-4">
            {groups.map((group) => (
              <section key={group.title}>
                <h3 className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {group.title}
                </h3>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-between gap-3 rounded-xl px-4 py-4 text-base font-medium text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                      >
                        <span>{item.label}</span>
                        <span aria-hidden="true" className="text-slate-300 text-xl leading-none">
                          ‹
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
