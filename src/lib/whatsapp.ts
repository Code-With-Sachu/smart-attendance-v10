import type { AttendanceRecord, MessageStyle, WhatsAppSendMode } from "@/lib/types";
import { formatRoll, formatTime, parseISODate, percent, rollWidth } from "@/lib/format";
import { recordNames, type NameMap } from "@/lib/names";

export const SEND_MODE_LABEL: Record<WhatsAppSendMode, string> = {
  both: "Absent + present",
  absent: "Absent only",
  present: "Present only",
};

export interface MessageOptions {
  teacherName?: string;
  teacherSubject?: string;
  institution?: string;
  mode?: WhatsAppSendMode;
  style?: MessageStyle;
  /** roll → overall attendance rate (0–1) in this subject; shown next to each student. */
  rates?: Record<number, number | null>;
  lowThreshold?: number;
}

const RULE = "━━━━━━━━━━━━━━━━━━";

function fullDate(iso: string) {
  const d = parseISODate(iso);
  return `${d.toLocaleDateString("en-GB", { weekday: "long" })}, ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`;
}

function studentLines(rolls: number[], width: number, names: NameMap, o: MessageOptions, numbered: boolean): string {
  if (!rolls.length) return o.style === "plain" ? "None" : "_None_";
  const hasNames = Object.keys(names).length > 0;
  const showRate = !!o.rates;
  // Without names or rates, a compact comma list reads best.
  if (!hasNames && !showRate) {
    const out: string[] = [];
    for (let i = 0; i < rolls.length; i += 10) out.push(rolls.slice(i, i + 10).map((n) => formatRoll(n, width)).join(", "));
    return out.join("\n");
  }
  const low = (o.lowThreshold ?? 75) / 100;
  return rolls
    .map((n, i) => {
      const name = names[n] ? ` – ${names[n]}` : "";
      const r = o.rates?.[n];
      const rate = showRate && r !== undefined && r !== null ? ` (${percent(r, 1, 0)}${r < low && o.style !== "plain" ? " ⚠️" : ""})` : "";
      return `${numbered ? `${i + 1}. ` : ""}${formatRoll(n, width)}${name}${rate}`;
    })
    .join("\n");
}

/**
 * Attendance report formatted for WhatsApp (uses *bold* and _italic_ markup, which reads
 * fine as plain text elsewhere). "professional" adds clear section icons and dividers.
 */
export function buildAttendanceMessage(r: AttendanceRecord, o: MessageOptions = {}): string {
  const mode = o.mode ?? "both";
  const width = rollWidth(r.rollNumbers);
  const total = r.rollNumbers.length;
  const names = recordNames(r);
  const pro = (o.style ?? "professional") === "professional";
  const lines: string[] = [];

  if (pro) {
    if (o.institution?.trim()) lines.push(`🏛️ *${o.institution.trim().toUpperCase()}*`);
    lines.push("📋 *ATTENDANCE REPORT*", RULE);
    lines.push(`🏫 *Class:* ${r.mainModuleName}`);
    lines.push(`📘 *Subject:* ${r.subModuleName}`);
    lines.push(`📅 *Date:* ${fullDate(r.date)}`);
    lines.push(`⏰ *Time:* ${formatTime(r.takenAt)} · Period ${r.session}`);
    lines.push(RULE);
    lines.push(`👥 *Total:* ${total}   ✅ *Present:* ${r.present.length}   ❌ *Absent:* ${r.absent.length}`);
    lines.push(`📊 *Attendance:* ${percent(r.present.length, total)}`);
    if (mode !== "present") lines.push("", `❌ *ABSENTEES (${r.absent.length})*`, studentLines(r.absent, width, names, o, true));
    if (mode !== "absent") lines.push("", `✅ *PRESENT (${r.present.length})*`, studentLines(r.present, width, names, o, true));
    if (o.rates) lines.push("", `_(%) = student’s overall attendance in this subject${o.lowThreshold ? ` · ⚠️ below ${o.lowThreshold}%` : ""}_`);
    lines.push(RULE);
    const sign = [o.teacherName?.trim(), o.teacherSubject?.trim()].filter(Boolean).join(", ");
    if (sign) lines.push(`👤 ${sign}`);
    lines.push("_Sent via Smart Attendance_");
  } else {
    if (o.institution?.trim()) lines.push(o.institution.trim());
    lines.push("ATTENDANCE REPORT", "");
    lines.push(`Class: ${r.mainModuleName}`, `Subject: ${r.subModuleName}`, `Date: ${fullDate(r.date)}`, `Time: ${formatTime(r.takenAt)} (Period ${r.session})`, "");
    lines.push(`Total: ${total} | Present: ${r.present.length} | Absent: ${r.absent.length}`, `Attendance: ${percent(r.present.length, total)}`);
    if (mode !== "present") lines.push("", `ABSENT (${r.absent.length}):`, studentLines(r.absent, width, names, o, false));
    if (mode !== "absent") lines.push("", `PRESENT (${r.present.length}):`, studentLines(r.present, width, names, o, false));
    if (o.teacherName?.trim()) lines.push("", `— ${o.teacherName.trim()}`);
  }
  return lines.join("\n");
}

/**
 * wa.me deep link. Opens WhatsApp (app or web) with the message pre-filled;
 * the teacher confirms and presses send. No credentials involved.
 */
export function whatsappLink(message: string, phone?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** CSV of one record (for "Share as file" / downloads). */
export function recordCsv(r: AttendanceRecord, rates?: Record<number, number | null>): string {
  const names = recordNames(r);
  const width = rollWidth(r.rollNumbers);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [["Roll No", "Name", "Status", "Overall %"]];
  for (const n of r.rollNumbers) {
    const rate = rates?.[n];
    rows.push([formatRoll(n, width), names[n] ?? "", r.absent.includes(n) ? "Absent" : "Present", rate === undefined || rate === null ? "" : (rate * 100).toFixed(1)]);
  }
  return [
    `Class,${esc(r.mainModuleName)}`,
    `Subject,${esc(r.subModuleName)}`,
    `Date,${r.date}`,
    `Time,${formatTime(r.takenAt)}`,
    `Period,${r.session}`,
    `Present,${r.present.length}`,
    `Absent,${r.absent.length}`,
    "",
    ...rows.map((x) => x.map(esc).join(",")),
  ].join("\n");
}
