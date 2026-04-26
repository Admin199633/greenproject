"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api-base";

interface SavedItem {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: string | number;
  unit: string | null;
}

interface Props {
  items: SavedItem[];
}

export default function SavedItemsManager({ items: initialItems }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<SavedItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("שם חובה");
      return;
    }
    if (!defaultPrice.trim() || Number.isNaN(parseFloat(defaultPrice))) {
      setFormError("מחיר חובה");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/saved-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          defaultPrice: parseFloat(defaultPrice) || 0,
          unit: unit.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast((data as { error?: string }).error ?? "שגיאה בשמירה", "error");
        return;
      }
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setName("");
      setDescription("");
      setDefaultPrice("");
      setUnit("");
      toast("הפריט נשמר");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("למחוק פריט זה?")) return;
    const res = await fetch(`${API_BASE}/saved-items/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      toast("שגיאה במחיקה", "error");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast("הפריט נמחק");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Existing items */}
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">אין פריטים שמורים עדיין</p>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 px-4 py-3 bg-white hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm text-slate-800">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-slate-500 whitespace-pre-wrap line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-sm tabular-nums text-slate-700">
                  ₪{Number(item.defaultPrice).toFixed(2)}
                  {item.unit ? ` / ${item.unit}` : ""}
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors text-sm"
                >
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="space-y-3 pt-2 border-t border-slate-100">
        <p className="text-sm font-medium text-slate-700">הוסף פריט חדש</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="si-name">שם</Label>
            <Input
              id="si-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="צילום אירוע"
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="si-price">מחיר ברירת מחדל (₪)</Label>
            <Input
              id="si-price"
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              className="text-left"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="si-unit">יחידה (אופציונלי)</Label>
            <Input
              id="si-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="שעה / יח׳ / יום"
              maxLength={50}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="si-description">תיאור (אופציונלי)</Label>
          <textarea
            id="si-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={"שירותי צילום לאירוע\nכולל עריכה בסיסית"}
            maxLength={500}
            className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 resize-none"
          />
        </div>
        {formError && <p className="text-xs text-red-600">{formError}</p>}
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "שומר..." : "הוסף פריט"}
        </Button>
      </form>
    </div>
  );
}
