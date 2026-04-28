"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Time24Input } from "@/components/ui/Time24Input";
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
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/validations/payment";
import { API_BASE } from "@/lib/api-base";

interface SavedItemOption {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: string | number;
  unit: string | null;
}

export interface DocumentFormDefaults {
  type: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  internalNotes: string;
  currency: string;
  isTaxInclusive: boolean;
  vatRateSnapshot: string;
  items: ItemRow[];
  eventDate?: string;
  eventLocation?: string;
  eventHours?: string;
  eventTime?: string;
  receiptAmountReceived?: string;
  receiptPaymentMethod?: PaymentMethod;
  receiptPaymentReference?: string;
  receiptCheckNumber?: string;
  receiptCheckBank?: string;
  receiptCheckBranch?: string;
  receiptCheckAccount?: string;
  receiptCheckDueDate?: string;
}

interface Props {
  mode: "create" | "edit";
  documentId?: string;
  savedItems?: SavedItemOption[];
  businessType?: string;
  isExempt?: boolean;
  defaultValues?: Partial<DocumentFormDefaults>;
}

function generateKey() {
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

const REFERENCE_METHODS: PaymentMethod[] = [
  "bank_transfer",
  "credit_card",
  "bit",
  "paybox",
];

export default function DocumentForm({
  mode,
  documentId,
  savedItems = [],
  businessType = "general",
  isExempt = false,
  defaultValues,
}: Props) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState(defaultValues?.type ?? "INVOICE");
  const [customerName, setCustomerName] = useState(defaultValues?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(defaultValues?.customerPhone ?? "");
  const [customerEmail, setCustomerEmail] = useState(defaultValues?.customerEmail ?? "");
  const [issueDate, setIssueDate] = useState(defaultValues?.issueDate ?? today);
  const [dueDateTouched, setDueDateTouched] = useState(
    !!(defaultValues?.dueDate && defaultValues.dueDate !== defaultValues?.issueDate)
  );
  const [dueDate, setDueDate] = useState(defaultValues?.dueDate ?? today);
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

  const [eventDate, setEventDate] = useState(defaultValues?.eventDate ?? "");
  const [eventLocation, setEventLocation] = useState(
    defaultValues?.eventLocation ?? ""
  );
  const [eventHours, setEventHours] = useState(defaultValues?.eventHours ?? "");
  const [eventTime, setEventTime] = useState(defaultValues?.eventTime ?? "");

  const [receiptAmountReceived, setReceiptAmountReceived] = useState(
    defaultValues?.receiptAmountReceived ?? ""
  );
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<
    PaymentMethod | ""
  >(defaultValues?.receiptPaymentMethod ?? "");
  const [receiptPaymentReference, setReceiptPaymentReference] = useState(
    defaultValues?.receiptPaymentReference ?? ""
  );
  const [receiptCheckNumber, setReceiptCheckNumber] = useState(
    defaultValues?.receiptCheckNumber ?? ""
  );
  const [receiptCheckBank, setReceiptCheckBank] = useState(
    defaultValues?.receiptCheckBank ?? ""
  );
  const [receiptCheckBranch, setReceiptCheckBranch] = useState(
    defaultValues?.receiptCheckBranch ?? ""
  );
  const [receiptCheckAccount, setReceiptCheckAccount] = useState(
    defaultValues?.receiptCheckAccount ?? ""
  );
  const [receiptCheckDueDate, setReceiptCheckDueDate] = useState(
    defaultValues?.receiptCheckDueDate ?? ""
  );

  const [items, setItems] = useState<ItemRow[]>(
    defaultValues?.items?.length ? defaultValues.items : [emptyItem()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPhotographyFields = businessType === "photography" && type === "QUOTE";
  const showReceiptFields = type === "RECEIPT" || type === "INVOICE_RECEIPT";
  const showReferenceField =
    receiptPaymentMethod !== "" &&
    REFERENCE_METHODS.includes(receiptPaymentMethod as PaymentMethod);
  const showCheckFields = receiptPaymentMethod === "check";

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

  async function handleSave() {
    setError(null);

    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    const trimmedEmail = customerEmail.trim();

    if (!trimmedName) {
      setError("יש להזין שם לקוח");
      return;
    }
    if (!trimmedPhone) {
      setError("יש להזין מספר טלפון של הלקוח");
      return;
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("כתובת אימייל לא תקינה");
      return;
    }

    const validItems = items
      .map((item, idx) => ({ item, calc: itemCalcs[idx] }))
      .filter(({ item }) => item.description.trim());

    if (validItems.length === 0) {
      setError("יש להוסיף לפחות פריט אחד עם תיאור");
      return;
    }

    if (showReceiptFields) {
      const parsedAmount = parseFloat(receiptAmountReceived);
      if (!receiptAmountReceived || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("יש להזין סכום שהתקבל");
        return;
      }
      if (!receiptPaymentMethod) {
        setError("יש לבחור אמצעי תשלום");
        return;
      }
      if (parsedAmount > docTotals.totalAmount) {
        setError("סכום שהתקבל לא יכול לעלות על סכום המסמך");
        return;
      }
    }

    setSaving(true);

    const payload = {
      type,
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      customerEmail: trimmedEmail || undefined,
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
      ...(showPhotographyFields && {
        eventDate: eventDate || undefined,
        eventLocation: eventLocation || undefined,
        eventHours: eventHours ? parseFloat(eventHours) : undefined,
        eventTime: eventTime || undefined,
      }),
      receiptAmountReceived:
        showReceiptFields && receiptAmountReceived
          ? Number(receiptAmountReceived).toFixed(2)
          : undefined,
      receiptPaymentMethod:
        showReceiptFields && receiptPaymentMethod ? receiptPaymentMethod : undefined,
      receiptPaymentReference:
        showReceiptFields && receiptPaymentReference
          ? receiptPaymentReference
          : undefined,
      receiptCheckNumber:
        showReceiptFields && receiptCheckNumber ? receiptCheckNumber : undefined,
      receiptCheckBank:
        showReceiptFields && receiptCheckBank ? receiptCheckBank : undefined,
      receiptCheckBranch:
        showReceiptFields && receiptCheckBranch ? receiptCheckBranch : undefined,
      receiptCheckAccount:
        showReceiptFields && receiptCheckAccount ? receiptCheckAccount : undefined,
      receiptCheckDueDate:
        showReceiptFields && receiptCheckDueDate ? receiptCheckDueDate : undefined,
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
      mode === "create"
        ? `${API_BASE}/documents`
        : `${API_BASE}/documents/${documentId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error ??
            "שגיאה בשמירה"
        );
        return;
      }

      if (mode === "create") {
        const data = (await res.json()) as { id: string };
        router.push(`/documents/${data.id}`);
      } else {
        router.push(`/documents/${documentId}`);
      }
      router.refresh();
    } catch {
      setError("שגיאת רשת - אנא נסה שנית");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      <Card>
        <CardHeader>
          <CardTitle>פרטי הלקוח</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="customerName">שם הלקוח *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="ישראל ישראלי"
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerPhone">טלפון *</Label>
              <Input
                id="customerPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="050-1234567"
                maxLength={30}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerEmail">אימייל</Label>
              <Input
                id="customerEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
                className="text-left"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>פרטי המסמך</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type">סוג מסמך</Label>
              <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
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
                  const value = e.target.value;
                  setIssueDate(value);
                  if (!dueDateTouched) setDueDate(value);
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

          {showPhotographyFields && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
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
                <Time24Input
                  id="eventTime"
                  value={eventTime}
                  onChange={setEventTime}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={isTaxInclusive}
                onChange={(e) => setIsTaxInclusive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              />
              <span className="text-sm text-slate-700">מחירים כוללים מע"מ</span>
            </label>

            <div className="flex items-center gap-2">
              <Label htmlFor="vatRate" className="whitespace-nowrap">
                שיעור מע"מ (%)
              </Label>
              <Input
                id="vatRate"
                type="number"
                inputMode="decimal"
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

      {showReceiptFields && (
        <Card>
          <CardHeader>
            <CardTitle>פרטי תשלום</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="receiptAmountReceived">סכום שהתקבל *</Label>
                <Input
                  id="receiptAmountReceived"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  dir="ltr"
                  value={receiptAmountReceived}
                  onChange={(e) => setReceiptAmountReceived(e.target.value)}
                  className="text-left"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="receiptPaymentMethod">אמצעי תשלום *</Label>
                <Select
                  id="receiptPaymentMethod"
                  value={receiptPaymentMethod}
                  onChange={(e) =>
                    setReceiptPaymentMethod(e.target.value as PaymentMethod | "")
                  }
                  required
                >
                  <option value="">בחר אמצעי תשלום</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {showReferenceField && (
              <div className="space-y-1.5">
                <Label htmlFor="receiptPaymentReference">מספר אסמכתא / עסקה</Label>
                <Input
                  id="receiptPaymentReference"
                  value={receiptPaymentReference}
                  onChange={(e) => setReceiptPaymentReference(e.target.value)}
                  maxLength={200}
                  placeholder="מספר עסקה או אסמכתא"
                />
              </div>
            )}

            {showCheckFields && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="receiptCheckNumber">מספר שיק</Label>
                  <Input
                    id="receiptCheckNumber"
                    value={receiptCheckNumber}
                    onChange={(e) => setReceiptCheckNumber(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="receiptCheckBank">בנק</Label>
                  <Input
                    id="receiptCheckBank"
                    value={receiptCheckBank}
                    onChange={(e) => setReceiptCheckBank(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="receiptCheckBranch">סניף</Label>
                  <Input
                    id="receiptCheckBranch"
                    value={receiptCheckBranch}
                    onChange={(e) => setReceiptCheckBranch(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="receiptCheckAccount">חשבון</Label>
                  <Input
                    id="receiptCheckAccount"
                    value={receiptCheckAccount}
                    onChange={(e) => setReceiptCheckAccount(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="receiptCheckDueDate">תאריך פירעון</Label>
                  <Input
                    id="receiptCheckDueDate"
                    type="date"
                    dir="ltr"
                    value={receiptCheckDueDate}
                    onChange={(e) => setReceiptCheckDueDate(e.target.value)}
                    className="text-left"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                  const picked = savedItems.find((item) => item.id === e.target.value);
                  if (!picked) return;
                  e.target.value = "";
                  setItems((prev) => [
                    ...prev,
                    {
                      key: generateKey(),
                      description: picked.description ?? picked.name,
                      quantity: "1",
                      unitPrice: String(Number(picked.defaultPrice)),
                      discountAmount: "0",
                    },
                  ]);
                }}
              >
                <option value="">+ הוסף מפריט שמור</option>
                {savedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {Number(item.defaultPrice).toFixed(2)}
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

      <Card>
        <CardContent className="pt-4">
          <dl className="mr-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">סכום לפני מע"מ</dt>
              <dd className="font-medium tabular-nums">
                {formatCurrency(docTotals.subtotalAmount)}
              </dd>
            </div>
            {!isExempt && (
              <div className="flex justify-between">
                <dt className="text-slate-500">מע"מ ({vatRateSnapshot}%)</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(docTotals.taxAmount)}
                </dd>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1">
              <dt className="font-semibold text-slate-800">סה"כ לתשלום</dt>
              <dd className="text-lg font-bold text-slate-900 tabular-nums">
                {formatCurrency(docTotals.totalAmount)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

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
              className="flex w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
              className="flex w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="h-4 sm:h-0" aria-hidden="true" />

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-11 flex-1 sm:h-9 sm:flex-initial"
        >
          {saving ? "שומר..." : "שמור טיוטה"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() =>
            router.push(
              mode === "edit" && documentId ? `/documents/${documentId}` : "/documents"
            )
          }
          className="h-11 flex-1 sm:h-9 sm:flex-initial"
        >
          ביטול
        </Button>
      </div>
    </div>
  );
}
