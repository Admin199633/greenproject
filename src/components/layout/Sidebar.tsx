"use client";

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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-white border-l border-slate-200 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-slate-200">
        <h1 className="text-base font-bold text-slate-800 truncate">
          מסמכים עסקיים
        </h1>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
