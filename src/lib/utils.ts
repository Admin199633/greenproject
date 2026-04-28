export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
  }).format(Number(amount));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("he-IL").format(new Date(date));
}

export function formatEventTime(value?: string | null): string {
  const rawValue = value?.trim();
  if (!rawValue) {
    return "";
  }

  const match = rawValue.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!match) {
    return rawValue;
  }

  const [, rawHours, rawMinutes = "00", meridiem] = match;
  let hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return rawValue;
  }

  if (minutes < 0 || minutes > 59) {
    return rawValue;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return rawValue;
    }

    const upperMeridiem = meridiem.toUpperCase();
    if (upperMeridiem === "AM") {
      hours = hours % 12;
    } else {
      hours = hours % 12 + 12;
    }
  } else if (hours < 0 || hours > 23) {
    return rawValue;
  }

  return `${hours.toString().padStart(2, "0")}:${rawMinutes}`;
}
