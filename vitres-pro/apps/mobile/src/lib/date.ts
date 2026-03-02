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

// ─── FONCTIONS FUSEAU EUROPE/BRUSSELS ──────────────────────────────────────

/** Convertit une Date (UTC) en "YYYY-MM-DDTHH:MM" dans le fuseau Brussels */
export function toBrusselsDateTimeString(d: Date): string {
  const fmt = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const h = get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${h === "24" ? "00" : h}:${get("minute")}`;
}

/**
 * Parse "YYYY-MM-DDTHH:MM" interprété comme heure Brussels → Date UTC.
 * Calcule l'offset DST exact sans l'hardcoder.
 */
export function parseBrusselsDateTimeString(s: string): Date {
  const [datePart, timePart = "00:00"] = (s || "").replace("T", " ").split(" ");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  if (!y || !mo || !d) return new Date(s);
  // 1. Approximation UTC
  const utcMs = Date.UTC(y, mo - 1, d, h, mi);
  // 2. Ce que Brussels lit pour ce UTC
  const br = toBrusselsDateTimeString(new Date(utcMs));
  const [bd, bt = "00:00"] = br.split("T");
  const [by, bmo, bday] = bd.split("-").map(Number);
  const [bh, bmi] = bt.split(":").map(Number);
  const brMs = Date.UTC(by, bmo - 1, bday, bh, bmi);
  // 3. Offset et correction
  return new Date(utcMs + (utcMs - brMs));
}

// ─── FONCTIONS LOCALES (conservées) ─────────────────────────────────────────

/** Format local: "YYYY-MM-DD HH:MM" (pas UTC, évite les décalages) */
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
