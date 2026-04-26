"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
} from "@/lib/validations/document";

interface CustomerOption {
  id: string;
  fullName: string | null;
  companyName: string | null;
}

interface Props {
  customers: CustomerOption[];
}

export default function DocumentFilters({ customers }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const type = searchParams.get("type") ?? "";
  const customerId = searchParams.get("customerId") ?? "";
  const status = searchParams.get("status") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  // Debounce the text search only
  useEffect(() => {
    const timer = setTimeout(() => {
      update("q", search.trim());
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function customerLabel(c: CustomerOption) {
    return c.companyName || c.fullName || "—";
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Text search */}
      <div className="space-y-1">
        <label className="text-xs text-slate-500">חיפוש</label>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="מספר מסמך / שם לקוח..."
          className="w-48"
        />
      </div>

      {/* Type */}
      <div className="space-y-1">
        <label className="text-xs text-slate-500">סוג</label>
        <Select
          value={type}
          onChange={(e) => update("type", e.target.value)}
          className="w-44"
        >
          <option value="">כל הסוגים</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>

      {/* Customer */}
      <div className="space-y-1">
        <label className="text-xs text-slate-500">לקוח</label>
        <Select
          value={customerId}
          onChange={(e) => update("customerId", e.target.value)}
          className="w-44"
        >
          <option value="">כל הלקוחות</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {customerLabel(c)}
            </option>
          ))}
        </Select>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <label className="text-xs text-slate-500">סטטוס</label>
        <Select
          value={status}
          onChange={(e) => update("status", e.target.value)}
          className="w-36"
        >
          <option value="">כל הסטטוסים</option>
          {DOCUMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DOCUMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {/* Date range */}
      <div className="space-y-1">
        <label className="text-xs text-slate-500">מתאריך</label>
        <Input
          type="date"
          dir="ltr"
          value={dateFrom}
          onChange={(e) => update("dateFrom", e.target.value)}
          className="w-36 text-left"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-500">עד תאריך</label>
        <Input
          type="date"
          dir="ltr"
          value={dateTo}
          onChange={(e) => update("dateTo", e.target.value)}
          className="w-36 text-left"
        />
      </div>
    </div>
  );
}
