"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/validations/payment";
import { useToast } from "@/components/ui/Toast";

interface Props {
  documentId: string;
  /** Remaining balance as a 2dp string, e.g. "1500.00" */
  amountDue: string;
}

export default function AddPaymentForm({ documentId, amountDue }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError("הסכום חייב להיות גדול מאפס");
      return;
    }
    if (amountNum > parseFloat(amountDue)) {
      setError("הסכום עולה על יתרת החוב");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          amount,
          paymentDate,
          method,
          reference: reference || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? "שגיאה בשמירת התשלום";
        setError(msg);
        toast(msg, "error");
        return;
      }

      // Reset form fields and refresh the server component
      setAmount("");
      setReference("");
      setNotes("");
      toast("התשלום נשמר בהצלחה");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pay-amount">
            סכום{" "}
            <span className="text-slate-400 font-normal text-xs">
              (יתרה: {parseFloat(amountDue).toLocaleString("he-IL", { minimumFractionDigits: 2 })})
            </span>
          </Label>
          <Input
            id="pay-amount"
            type="number"
            step="0.01"
            min="0.01"
            max={amountDue}
            dir="ltr"
            className="text-left"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pay-date">תאריך תשלום</Label>
          <Input
            id="pay-date"
            type="date"
            dir="ltr"
            className="text-left"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pay-method">אמצעי תשלום</Label>
          <Select
            id="pay-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            required
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pay-ref">אסמכתא / מסמך</Label>
          <Input
            id="pay-ref"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="אופציונלי"
            maxLength={200}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pay-notes">הערות</Label>
        <Input
          id="pay-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="אופציונלי"
          maxLength={2000}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "שומר..." : "הוסף תשלום"}
      </Button>
    </form>
  );
}
