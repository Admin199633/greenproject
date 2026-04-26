"use client";

import { Button } from "@/components/ui/Button";

interface HeaderProps {
  user: { name?: string | null; email: string };
}

async function handleSignOut() {
  await fetch("/api/auth/signout", { method: "POST" });
  window.location.href = "/login";
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="text-sm text-slate-600">
        שלום,{" "}
        <span className="font-medium text-slate-800">
          {user.name ?? user.email}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
      >
        התנתק
      </Button>
    </header>
  );
}
