"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import type { BusinessFormValues } from "@/lib/validations/business";
import { API_BASE } from "@/lib/api-base";

interface Props {
  defaultValues: {
    name: string;
    taxId?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    taxType?: "osek_murshe" | "osek_patur" | "chevra" | null;
    businessType?: "general" | "photography" | "contractor" | "consulting" | "retail" | "other" | null;
    vatRate?: number | null;
    currency?: string | null;
    invoiceNumberPrefix?: string | null;
    invoiceStartNumber?: number | null;
    receiptNumberPrefix?: string | null;
    receiptStartNumber?: number | null;
    quoteNumberPrefix?: string | null;
    quoteStartNumber?: number | null;
    invoiceReceiptNumberPrefix?: string | null;
    invoiceReceiptStartNumber?: number | null;
    sendIssueNotificationEmail?: boolean | null;
    quoteTermsText?: string | null;
    approvalWhatsappMessageTemplate?: string | null;
  };
}

const taxTypeLabels: Record<string, string> = {
  osek_murshe: "עוסק מורשה",
  osek_patur: "עוסק פטור",
  chevra: "חברה בע\"מ",
};

const businessTypeLabels: Record<string, string> = {
  general: "כללי",
  photography: "צילום",
  contractor: "קבלנות",
  consulting: "ייעוץ",
  retail: "קמעונאות",
  other: "אחר",
};

export default function BusinessSettingsForm({ defaultValues }: Props) {
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessFormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const textarea = document.getElementById(
      "approvalWhatsappMessageTemplate"
    ) as HTMLTextAreaElement | null;
    console.debug("[approval-template] settings mount", {
      defaultValueProp: defaultValues.approvalWhatsappMessageTemplate ?? null,
      defaultValuePropHasReplacement:
        (defaultValues.approvalWhatsappMessageTemplate ?? "").includes("\uFFFD"),
      domDefaultValue: textarea?.defaultValue ?? null,
      domDefaultValueHasReplacement:
        textarea?.defaultValue.includes("\uFFFD") ?? false,
      domValue: textarea?.value ?? null,
      domValueHasReplacement: textarea?.value.includes("\uFFFD") ?? false,
    });
  }, [defaultValues.approvalWhatsappMessageTemplate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    setSuccess(false);
    setErrors({});
    setServerError(null);

    const form = e.currentTarget;
    const get = (name: string) =>
      (
        form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
      )?.value ?? "";

    const getCheckbox = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement)?.checked ?? false;

    const getNumber = (name: string, fallback: number) => {
      const value = get(name).trim();
      return value === "" ? fallback : Number(value);
    };

    const data: BusinessFormValues = {
      name: get("name"),
      taxId: get("taxId"),
      address: get("address"),
      city: get("city"),
      postalCode: get("postalCode"),
      country: get("country"),
      phone: get("phone"),
      email: get("email"),
      taxType: get("taxType") as "osek_murshe" | "osek_patur" | "chevra",
      businessType: get("businessType") as "general" | "photography" | "contractor" | "consulting" | "retail" | "other",
      vatRate: Number(get("vatRate")) || 17,
      currency: get("currency"),
      invoiceNumberPrefix: get("invoiceNumberPrefix"),
      invoiceStartNumber: getNumber("invoiceStartNumber", 0),
      receiptNumberPrefix: get("receiptNumberPrefix"),
      receiptStartNumber: getNumber("receiptStartNumber", 0),
      quoteNumberPrefix: get("quoteNumberPrefix"),
      quoteStartNumber: getNumber("quoteStartNumber", 0),
      invoiceReceiptNumberPrefix: get("invoiceReceiptNumberPrefix"),
      invoiceReceiptStartNumber: getNumber("invoiceReceiptStartNumber", 0),
      sendIssueNotificationEmail: getCheckbox("sendIssueNotificationEmail"),
      quoteTermsText: get("quoteTermsText"),
      approvalWhatsappMessageTemplate: get("approvalWhatsappMessageTemplate"),
    };

    console.debug("[approval-template] settings before submit", {
      approvalWhatsappMessageTemplate: data.approvalWhatsappMessageTemplate,
      hasReplacement:
        data.approvalWhatsappMessageTemplate?.includes("\uFFFD") ?? false,
    });

    const res = await fetch(`${API_BASE}/business`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setIsPending(false);

    if (res.status === 422) {
      const json = await res.json();
      const fieldErrors: Partial<Record<keyof BusinessFormValues, string>> = {};
      for (const [key, msgs] of Object.entries(json.errors ?? {})) {
        fieldErrors[key as keyof BusinessFormValues] = (msgs as string[])[0];
      }
      setErrors(fieldErrors);
      return;
    }

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setServerError(json.error ?? "שגיאת שרת");
      return;
    }

    setSuccess(true);
  }

  const field = (
    id: keyof BusinessFormValues,
    label: string,
    props?: React.InputHTMLAttributes<HTMLInputElement>
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        defaultValue={
          defaultValues[id] != null ? String(defaultValues[id]) : ""
        }
        {...props}
      />
      {errors[id] && (
        <p className="text-xs text-red-600">{errors[id]}</p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Business identity */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">זהות העסק</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("name", "שם עסק *", { placeholder: 'עסק לדוגמה בע"מ' })}
          {field("taxId", "מספר עוסק / ח.פ. *", { placeholder: "514000000" })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="taxType">סוג עוסק</Label>
            <select
              id="taxType"
              name="taxType"
              defaultValue={defaultValues.taxType ?? "osek_murshe"}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {Object.entries(taxTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessType">סוג עסק</Label>
            <select
              id="businessType"
              name="businessType"
              defaultValue={defaultValues.businessType ?? "general"}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {Object.entries(businessTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">פרטי קשר</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("phone", "טלפון", {
            type: "tel",
            inputMode: "tel",
            autoComplete: "tel",
            placeholder: "03-1234567",
          })}
          {field("email", "אימייל", {
            type: "email",
            inputMode: "email",
            autoComplete: "email",
            placeholder: "info@example.co.il",
            dir: "ltr",
            className: "text-left",
          })}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">כתובת</h3>
        {field("address", "רחוב ומספר בית", { placeholder: "רחוב הרצל 1" })}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {field("city", "עיר", { placeholder: "תל אביב" })}
          {field("postalCode", "מיקוד", { placeholder: "6100001" })}
          {field("country", "מדינה", { placeholder: "IL" })}
        </div>
      </div>

      {/* Billing defaults */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">הגדרות חשבונאיות</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("vatRate", "שיעור מע״מ (%)", { type: "number", inputMode: "decimal", min: "0", max: "100", step: "0.01", placeholder: "17" })}
          {field("currency", "מטבע", { placeholder: "ILS" })}
        </div>
      </div>

      {/* Document numbering */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">מספור מסמכים</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("invoiceNumberPrefix", "קידומת טקסט לחשבונית", { placeholder: "INV-" })}
          {field("invoiceStartNumber", "מספר בסיס לחשבונית", {
            type: "number",
            inputMode: "numeric",
            min: "0",
            step: "1",
            placeholder: "0",
          })}
          {field("receiptNumberPrefix", "קידומת טקסט לקבלה", { placeholder: "REC-" })}
          {field("receiptStartNumber", "מספר בסיס לקבלה", {
            type: "number",
            inputMode: "numeric",
            min: "0",
            step: "1",
            placeholder: "0",
          })}
          {field("quoteNumberPrefix", "קידומת טקסט להצעת מחיר", { placeholder: "QUO-" })}
          {field("quoteStartNumber", "מספר בסיס להצעת מחיר", {
            type: "number",
            inputMode: "numeric",
            min: "0",
            step: "1",
            placeholder: "0",
          })}
          {field("invoiceReceiptNumberPrefix", "קידומת טקסט לחשבונית קבלה", { placeholder: "INVR-" })}
          {field("invoiceReceiptStartNumber", "מספר בסיס לחשבונית קבלה", {
            type: "number",
            inputMode: "numeric",
            min: "0",
            step: "1",
            placeholder: "0",
          })}
        </div>
      </div>

      {/* Notification settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">התראות</h3>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            id="sendIssueNotificationEmail"
            name="sendIssueNotificationEmail"
            defaultChecked={defaultValues.sendIssueNotificationEmail ?? false}
            className="w-4 h-4 rounded border-slate-300 accent-brand-600"
          />
          <span className="text-sm text-slate-700">
            שלח אימייל לעסק בעת הנפקת מסמך
          </span>
        </label>
        <p className="text-xs text-slate-500 -mt-2">
          כאשר מסמך מונפק, תישלח הודעה לכתובת האימייל של העסק שהוגדרה למעלה.
        </p>
      </div>

      {/* Quote terms / small print */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">הצעות מחיר</h3>
        <div className="space-y-1.5">
          <Label htmlFor="quoteTermsText">אותיות קטנות להצעת מחיר</Label>
          <textarea
            id="quoteTermsText"
            name="quoteTermsText"
            rows={6}
            defaultValue={defaultValues.quoteTermsText ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-slate-500">
            הטקסט יופיע אוטומטית בכל הצעת מחיר חדשה.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">הודעות ללקוחות</h3>
        <div className="space-y-1.5">
          <Label htmlFor="approvalWhatsappMessageTemplate">
            הודעת וואטסאפ לשליחת הצעת מחיר
          </Label>
          <textarea
            id="approvalWhatsappMessageTemplate"
            name="approvalWhatsappMessageTemplate"
            rows={8}
            defaultValue={defaultValues.approvalWhatsappMessageTemplate ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-slate-500">
            אפשר להשתמש במשתנים: {"{customerName}"}, {"{approvalUrl}"}, {"{eventDate}"}, {"{eventTime}"}, {"{eventLocation}"}, {"{businessName}"}
          </p>
          {errors.approvalWhatsappMessageTemplate && (
            <p className="text-xs text-red-600">
              {errors.approvalWhatsappMessageTemplate}
            </p>
          )}
        </div>
      </div>

      {serverError && (
        <p className="text-sm text-red-600" role="alert">{serverError}</p>
      )}
      {success && (
        <p className="text-sm text-green-600" role="status">הפרטים נשמרו בהצלחה</p>
      )}

      <div className="pt-1">
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={isPending}
        >
          {isPending ? "שומר..." : "שמור שינויים"}
        </Button>
      </div>
    </form>
  );
}
