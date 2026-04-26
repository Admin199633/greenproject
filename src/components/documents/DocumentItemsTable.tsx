"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import type { ItemCalcResult } from "@/lib/documents/calculations";

export interface ItemRow {
  key: string; // stable React key
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
}

interface Props {
  items: ItemRow[];
  itemCalcs: ItemCalcResult[];
  onItemChange: (index: number, field: keyof Omit<ItemRow, "key">, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}

export default function DocumentItemsTable({
  items,
  itemCalcs,
  onItemChange,
  onAddItem,
  onRemoveItem,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Mobile card layout — single column inputs per item */}
      <div className="space-y-3 sm:hidden">
        {items.map((item, idx) => {
          const calc = itemCalcs[idx];
          return (
            <div
              key={item.key}
              className="rounded-md border border-slate-200 bg-white p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  פריט {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveItem(idx)}
                  disabled={items.length === 1}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="הסר שורה"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">תיאור</label>
                <Input
                  value={item.description}
                  onChange={(e) => onItemChange(idx, "description", e.target.value)}
                  placeholder="תיאור השירות / המוצר"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">כמות</label>
                  <Input
                    dir="ltr"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.001"
                    value={item.quantity}
                    onChange={(e) => onItemChange(idx, "quantity", e.target.value)}
                    className="text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">מחיר יחידה</label>
                  <Input
                    dir="ltr"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => onItemChange(idx, "unitPrice", e.target.value)}
                    placeholder="0.00"
                    className="text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">הנחה</label>
                  <Input
                    dir="ltr"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={item.discountAmount}
                    onChange={(e) => onItemChange(idx, "discountAmount", e.target.value)}
                    placeholder="0.00"
                    className="text-left"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-600">סה״כ</span>
                  <p className="h-9 flex items-center justify-end px-2 text-left font-medium text-slate-800 tabular-nums">
                    {formatCurrency(calc?.totalAmount ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>לפני מע״מ: <span className="tabular-nums">{formatCurrency(calc?.subtotalAmount ?? 0)}</span></span>
                <span>מע״מ: <span className="tabular-nums">{formatCurrency(calc?.taxAmount ?? 0)}</span></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-right font-medium w-8">#</th>
              <th className="px-3 py-2 text-right font-medium">תיאור</th>
              <th className="px-3 py-2 text-left font-medium w-24">כמות</th>
              <th className="px-3 py-2 text-left font-medium w-28">מחיר יחידה</th>
              <th className="px-3 py-2 text-left font-medium w-24">הנחה</th>
              <th className="px-3 py-2 text-left font-medium w-28">לפני מע״מ</th>
              <th className="px-3 py-2 text-left font-medium w-24">מע״מ</th>
              <th className="px-3 py-2 text-left font-medium w-28">סה״כ</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const calc = itemCalcs[idx];
              return (
                <tr key={item.key} className="bg-white">
                  <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>

                  <td className="px-3 py-2">
                    <Input
                      value={item.description}
                      onChange={(e) => onItemChange(idx, "description", e.target.value)}
                      placeholder="תיאור השירות / המוצר"
                      className="min-w-[180px]"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      dir="ltr"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.001"
                      value={item.quantity}
                      onChange={(e) => onItemChange(idx, "quantity", e.target.value)}
                      className="text-left w-24"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      dir="ltr"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => onItemChange(idx, "unitPrice", e.target.value)}
                      placeholder="0.00"
                      className="text-left w-28"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <Input
                      dir="ltr"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={item.discountAmount}
                      onChange={(e) => onItemChange(idx, "discountAmount", e.target.value)}
                      placeholder="0.00"
                      className="text-left w-24"
                    />
                  </td>

                  {/* Calculated — read-only */}
                  <td className="px-3 py-2 text-left text-slate-700 tabular-nums">
                    {formatCurrency(calc?.subtotalAmount ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-left text-slate-500 tabular-nums">
                    {formatCurrency(calc?.taxAmount ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-left font-medium text-slate-800 tabular-nums">
                    {formatCurrency(calc?.totalAmount ?? 0)}
                  </td>

                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(idx)}
                      disabled={items.length === 1}
                      className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="הסר שורה"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onAddItem}
        className="w-full sm:w-auto h-11 sm:h-9 sm:text-xs"
      >
        + הוסף שורה
      </Button>
    </div>
  );
}
