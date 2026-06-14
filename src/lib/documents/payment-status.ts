export type PaymentDueStatus = "none" | "overdue" | "upcoming";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getPaymentDueStatus(
  eventDate: Date | string | null | undefined,
  now: Date = new Date()
): PaymentDueStatus {
  if (eventDate == null || eventDate === "") return "none";
  const target = eventDate instanceof Date ? eventDate : new Date(eventDate);
  if (Number.isNaN(target.getTime())) return "none";

  const targetDay = startOfLocalDay(target);
  const today = startOfLocalDay(now);

  if (targetDay.getTime() < today.getTime()) return "overdue";
  return "upcoming";
}
