"use client";

import { useState } from "react";
import { API_BASE } from "@/lib/api-base";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface ApprovalFormProps {
  token: string;
  customerName: string;
}

type FormState = "idle" | "loading" | "success" | "error";

export default function ApprovalForm({
  token,
  customerName,
}: ApprovalFormProps) {
  const [approvedByName, setApprovedByName] = useState(customerName || "");
  const [accepted, setAccepted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = approvedByName.trim();
    if (!trimmedName) {
      setState("error");
      setError("יש למלא שם מלא");
      return;
    }

    if (!accepted) {
      setState("error");
      setError("יש לאשר את פרטי ההצעה והתנאים");
      return;
    }

    setState("loading");
    setError("");

    try {
      const res = await fetch(
        `${API_BASE}/public/approve/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvedByName: trimmedName }),
        }
      );

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setState("error");
        setError(data.error ?? "אירעה שגיאה באישור ההצעה");
        return;
      }

      setState("success");
    } catch {
      setState("error");
      setError("אירעה שגיאת רשת. יש לנסות שוב.");
    }
  }

  if (state === "success") {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:p-6">
        <p className="text-base font-semibold text-emerald-800">
          הצעת המחיר אושרה בהצלחה
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">אישור ההצעה</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        יש למלא שם מלא ולאשר את פרטי ההצעה והתנאים כדי להשלים את האישור.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" dir="rtl">
        <div className="space-y-2">
          <label
            htmlFor="approvedByName"
            className="block text-sm font-medium text-slate-700"
          >
            שם מלא
          </label>
          <Input
            id="approvedByName"
            value={approvedByName}
            onChange={(event) => setApprovedByName(event.target.value)}
            placeholder="הקלד/י שם מלא"
            autoComplete="name"
            className="h-11 text-base"
            disabled={state === "loading"}
          />
        </div>

        <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            disabled={state === "loading"}
          />
          <span>קראתי ואני מאשר/ת את פרטי ההצעה והתנאים</span>
        </label>

        {state === "error" && error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="min-h-[48px] w-full text-base"
          disabled={state === "loading"}
        >
          {state === "loading" ? "מאשר/ת..." : "מאשר/ת את הצעת המחיר"}
        </Button>
      </form>
    </section>
  );
}
