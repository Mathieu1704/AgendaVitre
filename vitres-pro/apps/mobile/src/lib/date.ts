// apps/mobile/src/lib/date.ts
const pad2 = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function parseISODate(iso: string): Date {
  // iso attendu: YYYY-MM-DD
  const [y, m, d] = iso.split("-").map((v) => Number(v));
  if (!y || !m || !d) return new Date(iso);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  const daysInTargetMonth = new Date(
    x.getFullYear(),
    x.getMonth() + 1,
    0
  ).getDate();
  x.setDate(Math.min(day, daysInTargetMonth));
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 0, 0, 0, 0);
}

export function startOfWeek(d: Date, firstDay: 0 | 1 = 1): Date {
  // firstDay=1 => lundi
  const x = startOfDay(d);
  const day = x.getDay(); // 0=dim ... 6=sam
  const diff = (day - firstDay + 7) % 7;
  return addDays(x, -diff);
}

export function datesRange(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** ✅ Format local: "YYYY-MM-DD HH:MM" (pas UTC, évite les décalages) */
export function toLocalDateTimeString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** ✅ Parse local: "YYYY-MM-DD HH:MM" ou "YYYY-MM-DDTHH:MM" -> Date locale */
export function parseLocalDateTimeString(s: string): Date {
  const raw = (s || "").trim().replace("T", " ");
  const [datePart, timePart = "00:00"] = raw.split(" ");
  const [y, m, d] = datePart.split("-").map((v) => Number(v));
  const [hh, mi] = timePart.split(":").map((v) => Number(v));

  if (!y || !m || !d) return new Date(s);
  return new Date(y, m - 1, d, hh || 0, mi || 0, 0, 0);
}
