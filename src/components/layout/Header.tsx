"use client";

import { Button } from "@/components/ui/Button";
import MobileNav from "@/components/layout/MobileNav";

interface HeaderProps {
  user: { name?: string | null; email: string };
}

async function handleSignOut() {
  await fetch("/api/auth/signout", { method: "POST" });
  window.location.href = "/login";
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between gap-2 px-4 sm:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <MobileNav />
        <div className="text-sm text-slate-600 truncate">
          שלום,{" "}
          <span className="font-medium text-slate-800">
            {user.name ?? user.email}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="shrink-0"
      >
        התנתק
      </Button>
    </header>
  );
}
