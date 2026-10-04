/** Date helpers. Attendance dates are stored as local calendar dates (YYYY-MM-DD). */

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function relativeDay(iso: string): string {
  const today = parseISODate(todayISO());
  const d = parseISODate(iso);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return formatShortDate(iso);
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

/** Zero-pad roll numbers to a consistent width (min 2 digits). */
export function rollWidth(rolls: number[]): number {
  const max = rolls.length ? Math.max(...rolls) : 0;
  return Math.max(2, String(max).length);
}

export function formatRoll(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

export function percent(part: number, total: number, digits = 1): string {
  if (!total) return "—";
  return `${((part / total) * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}
