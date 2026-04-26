"use client";

import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import type { FormState } from "@/app/(dashboard)/customers/actions";

interface CustomerFormProps {
  /** Server action — either createCustomerAction or updateCustomerAction.bind(null, id) */
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    fullName?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxId?: string | null;
    notes?: string | null;
  };
  cancelHref: string;
  submitLabel?: string;
}

export default function CustomerForm({
  action,
  defaultValues,
  cancelHref,
  submitLabel = "שמור",
}: CustomerFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useFormState(action, null);

  const err = (field: string) => state?.errors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Name fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">שם פרטי / שם מלא</Label>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={defaultValues?.fullName ?? ""}
            placeholder="ישראל ישראלי"
          />
          {err("fullName") && (
            <p className="text-xs text-red-600">{err("fullName")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="companyName">שם חברה / עסק</Label>
          <Input
            id="companyName"
            name="companyName"
            defaultValue={defaultValues?.companyName ?? ""}
            placeholder='חברה לדוגמה בע"מ'
          />
          {err("companyName") && (
            <p className="text-xs text-red-600">{err("companyName")}</p>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        * חובה למלא לפחות אחד מהשדות לעיל
      </p>

      {/* Contact fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">אימייל</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
            placeholder="customer@example.com"
          />
          {err("email") && (
            <p className="text-xs text-red-600">{err("email")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">טלפון</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaultValues?.phone ?? ""}
            placeholder="050-1234567"
          />
          {err("phone") && (
            <p className="text-xs text-red-600">{err("phone")}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">כתובת</Label>
        <Input
          id="address"
          name="address"
          defaultValue={defaultValues?.address ?? ""}
          placeholder="רחוב הרצל 1, תל אביב"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="taxId">מספר עוסק / ח.פ.</Label>
        <Input
          id="taxId"
          name="taxId"
          defaultValue={defaultValues?.taxId ?? ""}
          placeholder="514000000"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">הערות</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
          placeholder="הערות נוספות..."
          className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
      </div>

      {state?.message && (
        <p className="text-sm text-red-600" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex gap-3 justify-start pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? "שומר..." : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.push(cancelHref)}
        >
          ביטול
        </Button>
      </div>
    </form>
  );
}
