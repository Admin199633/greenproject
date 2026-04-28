"use client";

import { useMemo } from "react";
import { Select } from "@/components/ui/Select";

interface Time24InputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minuteStep?: 1 | 5 | 10 | 15 | 30;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function Time24Input({
  id,
  value,
  onChange,
  disabled,
  minuteStep = 15,
}: Time24InputProps) {
  const [hour, minute] = useMemo(() => {
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return ["", ""] as const;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return ["", ""] as const;
    if (h < 0 || h > 23 || m < 0 || m > 59) return ["", ""] as const;
    return [pad(h), pad(m)] as const;
  }, [value]);

  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, i) => pad(i)),
    []
  );

  const minuteOptions = useMemo(() => {
    const out: string[] = [];
    for (let m = 0; m < 60; m += minuteStep) out.push(pad(m));
    if (minute && !out.includes(minute)) {
      out.push(minute);
      out.sort();
    }
    return out;
  }, [minute, minuteStep]);

  function emit(nextHour: string, nextMinute: string) {
    if (!nextHour && !nextMinute) {
      onChange("");
      return;
    }
    const h = nextHour || "00";
    const m = nextMinute || "00";
    onChange(`${h}:${m}`);
  }

  return (
    <div
      id={id}
      dir="ltr"
      className="flex items-center gap-1.5"
      role="group"
      aria-label="שעה"
    >
      <Select
        aria-label="שעה"
        value={hour}
        disabled={disabled}
        onChange={(e) => emit(e.target.value, minute)}
        className="w-[5.5rem] text-center"
      >
        <option value="">--</option>
        {hourOptions.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </Select>
      <span className="font-semibold text-slate-500">:</span>
      <Select
        aria-label="דקות"
        value={minute}
        disabled={disabled}
        onChange={(e) => emit(hour, e.target.value)}
        className="w-[5.5rem] text-center"
      >
        <option value="">--</option>
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
    </div>
  );
}
