"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import DocumentItemsTable, {
  type ItemRow,
} from "@/components/documents/DocumentItemsTable";
import { calcItem, calcDocTotals } from "@/lib/documents/calculations";
import { formatCurrency } from "@/lib/utils";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/validations/document";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerOption {
  id: string;
  fullName: string | null;
  companyName: string | null;
}

interface SavedItemOption {
  id: string;
  name: string;
  description: string;
  defaultPrice: string | number;
  unit: string | null;
}

export interface DocumentFormDefaults {
  type: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  internalNotes: string;
  currency: string;
  isTaxInclusive: boolean;
  vatRateSnapshot: string;
  items: ItemRow[];
  // Photography quote fields
  eventDate?: string;
  eventLocation?: string;
  eventHours?: string;
  eventTime?: string;
}

interface Props {
  mode: "create" | "edit";
  documentId?: string;
  customers: CustomerOption[];
  savedItems?: SavedItemOption[];
  businessType?: string;
  isExempt?: boolean;
  defaultValues?: Partial<DocumentFormDefaults>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateKey(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function emptyItem(): ItemRow {
  return {
    key: generateKey(),
    description: "",
    quantity: "1",
    unitPrice: "",
    discountAmount: "0",
  };
}

function customerLabel(c: CustomerOption) {
  return c.companyName || c.fullName || "—";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentForm({
  mode,
  documentId,
  customers,
  savedItems = [],
  businessType = "general",
  isExempt = false,
  defaultValues,
}: Props) {
  const router = useRouter();

  // ── Header state ──────────────────────────────────────────────────────────
  const [type, setType] = useState(defaultValues?.type ?? "INVOICE");
  const [customerId, setCustomerId] = useState(defaultValues?.customerId ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [issueDate, setIssueDate] = useState(defaultValues?.issueDate ?? today);
  // dueDateTouched tracks whether the user has manually changed dueDate
  const [dueDateTouched, setDueDateTouched] = useState(
    !!(defaultValues?.dueDate && defaultValues.dueDate !== defaultValues?.issueDate)
  );
  const [dueDate, setDueDate] = useState(
    defaultValues?.dueDate ?? today
  );
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [internalNotes, setInternalNotes] = useState(
    defaultValues?.internalNotes ?? ""
  );
  const [currency] = useState(defaultValues?.currency ?? "ILS");
  const [isTaxInclusive, setIsTaxInclusive] = useState(
    defaultValues?.isTaxInclusive ?? false
  );
  const [vatRateSnapshot, setVatRateSnapshot] = useState(
    defaultValues?.vatRateSnapshot ?? "17"
  );

  // ── Photography fields state ──────────────────────────────────────────────
  const [eventDate, setEventDate] = useState(defaultValues?.eventDate ?? "");
  const [eventLocation, setEventLocation] = useState(defaultValues?.eventLocation ?? "");
  const [eventHours, setEventHours] = useState(defaultValues?.eventHours ?? "");
  const [eventTime, setEventTime] = useState(defaultValues?.eventTime ?? "");

  // ── Items state ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<ItemRow[]>(
    defaultValues?.items?.length ? defaultValues.items : [emptyItem()]
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Photography fields visibility ─────────────────────────────────────────
  const showPhotographyFields = businessType === "photography" && type === "QUOTE";

  // ── Live calculations ─────────────────────────────────────────────────────
  const parsedVatRate = parseFloat(vatRateSnapshot);
  const vatRate = Number.isFinite(parsedVatRate) ? parsedVatRate : 17;

  const itemCalcs = useMemo(
    () =>
      items.map((item) =>
        calcItem({
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseFloat(item.unitPrice) || 0,
          discountAmount: parseFloat(item.discountAmount) || 0,
          vatRate,
          isTaxInclusive,
        })
      ),
    [items, vatRate, isTaxInclusive]
  );

  const docTotals = useMemo(() => calcDocTotals(itemCalcs), [itemCalcs]);

  // ── Item handlers ─────────────────────────────────────────────────────────
  function handleItemChange(
    index: number,
    field: keyof Omit<ItemRow, "key">,
    value: string
  ) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function handleAddItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSave() {
    setError(null);

    if (!customerId) {
      setError("יש לבחור לקוח");
      return;
    }

    const validItems = items
      .map((item, idx) => ({ item, calc: itemCalcs[idx] }))
      .filter(({ item }) => item.description.trim());

    if (validItems.length === 0) {
      setError("יש להוסיף לפחות פריט אחד עם תיאור");
      return;
    }

    setSaving(true);

    const payload = {
      type,
      customerId,
      issueDate: issueDate || undefined,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      internalNotes: internalNotes || undefined,
      currency,
      isTaxInclusive,
      vatRateSnapshot: vatRate,
      subtotalAmount: docTotals.subtotalAmount.toFixed(2),
      taxAmount: docTotals.taxAmount.toFixed(2),
      totalAmount: docTotals.totalAmount.toFixed(2),
      amountDue: docTotals.amountDue.toFixed(2),
      // Photography quote fields — only sent when visible
      ...(showPhotographyFields && {
        eventDate: eventDate || undefined,
        eventLocation: eventLocation || undefined,
        eventHours: eventHours ? parseFloat(eventHours) : undefined,
        eventTime: eventTime || undefined,
      }),
      items: validItems.map(({ item, calc }, idx) => ({
        lineIndex: idx,
        description: item.description.trim(),
        quantity: item.quantity || "1",
        unitPrice: item.unitPrice || "0",
        discountAmount: item.discountAmount || "0",
        subtotalAmount: calc.subtotalAmount.toFixed(2),
        taxRate: vatRateSnapshot,
        taxAmount: calc.taxAmount.toFixed(2),
        totalAmount: calc.totalAmount.toFixed(2),
      })),
    };

    const url =
      mode === "create" ? "/api/documents" : `/api/documents/${documentId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "שגיאה בשמירה");
        return;
      }

      if (mode === "create") {
        const data = await res.json();
        router.push(`/documents/${data.id}`);
      } else {
        router.push(`/documents/${documentId}`);
      }
      router.refresh();
    } catch {
      setError("שגיאת רשת — אנא נסה שנית");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header card */}
      <Card>
        <CardHeader>
          <CardTitle>פרטי המסמך</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="type">סוג מסמך</Label>
              <Select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customerId">לקוח</Label>
              <Select
                id="customerId"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">— בחר לקוח —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {customerLabel(c)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issueDate">תאריך הנפקה</Label>
              <Input
                id="issueDate"
                type="date"
                dir="ltr"
                value={issueDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setIssueDate(v);
                  if (!dueDateTouched) setDueDate(v);
                }}
                className="text-left"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dueDate">תאריך תשלום</Label>
              <Input
                id="dueDate"
                type="date"
                dir="ltr"
                value={dueDate}
                onChange={(e) => {
                  setDueDateTouched(true);
                  setDueDate(e.target.value);
                }}
                className="text-left"
              />
            </div>
          </div>

          {/* Photography quote fields */}
          {showPhotographyFields && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="eventDate">תאריך האירוע</Label>
                <Input
                  id="eventDate"
                  type="date"
                  dir="ltr"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="text-left"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eventLocation">מיקום האירוע</Label>
                <Input
                  id="eventLocation"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="אולם אירועים, כתובת..."
                  maxLength={500}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eventTime">שעת האירוע</Label>
                <Input
                  id="eventTime"
                  type="time"
                  dir="ltr"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="text-left"
                />
              </div>
            </div>
          )}

          {/* VAT settings */}
          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isTaxInclusive}
                onChange={(e) => setIsTaxInclusive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 accent-brand-600"
              />
              <span className="text-sm text-slate-700">מחירים כוללים מע״מ</span>
            </label>

            <div className="flex items-center gap-2">
              <Label htmlFor="vatRate" className="whitespace-nowrap">
                שיעור מע״מ (%)
              </Label>
              <Input
                id="vatRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                dir="ltr"
                value={vatRateSnapshot}
                onChange={(e) => setVatRateSnapshot(e.target.value)}
                className="w-20 text-left"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items card */}
      <Card>
        <CardHeader>
          <CardTitle>פריטים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {savedItems.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                defaultValue=""
                onChange={(e) => {
                  const picked = savedItems.find((s) => s.id === e.target.value);
                  if (!picked) return;
                  e.target.value = "";
                  setItems((prev) => [
                    ...prev,
                    {
                      key: generateKey(),
                      description: picked.description,
                      quantity: "1",
                      unitPrice: String(Number(picked.defaultPrice)),
                      discountAmount: "0",
                    },
                  ]);
                }}
              >
                <option value="">+ הוסף מפריט שמור</option>
                {savedItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ₪{Number(s.defaultPrice).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DocumentItemsTable
            items={items}
            itemCalcs={itemCalcs}
            onItemChange={handleItemChange}
            onAddItem={handleAddItem}
            onRemoveItem={handleRemoveItem}
          />
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-4">
          <dl className="space-y-1 text-sm max-w-xs mr-auto">
            <div className="flex justify-between">
              <dt className="text-slate-500">סכום לפני מע״מ</dt>
              <dd className="font-medium tabular-nums">
                {formatCurrency(docTotals.subtotalAmount)}
              </dd>
            </div>
            {!isExempt && (
              <div className="flex justify-between">
                <dt className="text-slate-500">מע״מ ({vatRateSnapshot}%)</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(docTotals.taxAmount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
              <dt className="font-semibold text-slate-800">סה״כ לתשלום</dt>
              <dd className="font-bold text-lg tabular-nums text-slate-900">
                {formatCurrency(docTotals.totalAmount)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Notes card */}
      <Card>
        <CardHeader>
          <CardTitle>הערות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="notes">הערות ללקוח</Label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות שיופיעו במסמך..."
              className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="internalNotes">הערות פנימיות</Label>
            <textarea
              id="internalNotes"
              rows={2}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="הערות שלא יופיעו ללקוח..."
              className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error + Actions */}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "שומר..." : "שמור טיוטה"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() =>
            router.push(
              mode === "edit" && documentId
                ? `/documents/${documentId}`
                : "/documents"
            )
          }
        >
          ביטול
        </Button>
      </div>
    </div>
  );
}
