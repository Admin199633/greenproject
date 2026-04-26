"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "לוח בקרה" },
  { href: "/customers", label: "לקוחות" },
  { href: "/documents", label: "מסמכים" },
  { href: "/payments", label: "תשלומים" },
  { href: "/reports", label: "דוחות" },
  { href: "/settings", label: "הגדרות" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="פתח תפריט"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 h-11 w-11 -mr-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-800">תפריט</h2>
              <button
                type="button"
                aria-label="סגור תפריט"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 h-10 w-10"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 rounded-md text-base font-medium transition-colors min-h-[44px]",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
