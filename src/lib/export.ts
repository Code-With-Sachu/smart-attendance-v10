import type { AppData } from "@/lib/types";
import type { StoredFile } from "@/lib/files/types";
import { byNewest, mainOptionsWithHistory, studentReportsForMain } from "@/lib/store/selectors";
import { formatTime, parseISODate, todayISO } from "@/lib/format";
import { recordNames } from "@/lib/names";
import { blobToBase64 } from "@/lib/ai/chat";

/** Everything as an Excel workbook: sessions, per-student summary per class, and every absence. */
export async function exportWorkbook(d: AppData) {
  const XLSX = await import("@e965/xlsx");
  const wb = XLSX.utils.book_new();

  const sessions = [...d.records].sort(byNewest).map((r) => ({
    Date: r.date,
    Day: parseISODate(r.date).toLocaleDateString("en-GB", { weekday: "long" }),
    Year: parseISODate(r.date).getFullYear(),
    Time: formatTime(r.takenAt),
    Period: r.session,
    "Main Module": r.mainModuleName,
    "Sub Module": r.subModuleName,
    Total: r.rollNumbers.length,
    Present: r.present.length,
    Absent: r.absent.length,
    "Attendance %": r.rollNumbers.length ? Number(((r.present.length / r.rollNumbers.length) * 100).toFixed(1)) : 0,
    "Absent rolls": r.absent.join(", "),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessions.length ? sessions : [{ Info: "No attendance yet" }]), "Sessions");

  const absences: Record<string, string | number>[] = [];
  for (const r of d.records) {
    const names = recordNames(r);
    for (const n of r.absent) absences.push({ Date: r.date, Time: formatTime(r.takenAt), Period: r.session, Class: r.mainModuleName, Subject: r.subModuleName, Roll: n, Name: names[n] ?? "" });
  }
  absences.sort((a, b) => String(b.Date).localeCompare(String(a.Date)));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(absences.length ? absences : [{ Info: "No absences" }]), "Absences");

  const used = new Set<string>();
  for (const m of mainOptionsWithHistory(d)) {
    const reports = studentReportsForMain(d, m.id);
    if (!reports.length) continue;
    const subjects = Array.from(new Map(reports.flatMap((r) => r.subjects.map((s) => [s.subModuleId, s.subName] as const))).entries());
    const rows = reports.map((r) => {
      const row: Record<string, string | number> = { Roll: r.roll, Name: r.name, Present: r.present, Absent: r.absent, Total: r.total, "Overall %": r.rate === null ? "" : Number((r.rate * 100).toFixed(1)) };
      for (const [id, name] of subjects) {
        const s = r.subjects.find((x) => x.subModuleId === id);
        row[`${name} %`] = s?.rate == null ? "" : Number((s.rate * 100).toFixed(1));
      }
      return row;
    });
    let sheet = m.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || "Class";
    while (used.has(sheet)) sheet = sheet.slice(0, 26) + "_" + used.size;
    used.add(sheet);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet);
  }
  XLSX.writeFile(wb, `smart-attendance-${todayISO()}.xlsx`);
}

/** JSON backup; files are embedded as base64 when requested. */
export async function backupJson(d: AppData, files: StoredFile[] | null): Promise<string> {
  const out: Record<string, unknown> = { ...d, exportedAt: new Date().toISOString(), app: "smart-attendance" };
  if (files) {
    out.files = await Promise.all(
      files.map(async ({ blob, ...meta }) => ({ ...meta, blobBase64: blob ? await blobToBase64(blob) : null })),
    );
  }
  return JSON.stringify(out, null, 2);
}

export function filesFromBackup(raw: unknown): StoredFile[] {
  const arr = (raw as { files?: (StoredFile & { blobBase64?: string | null })[] })?.files;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((f) => f && typeof f.id === "string" && typeof f.name === "string")
    .map(({ blobBase64, ...f }) => {
      let blob: Blob | undefined;
      if (blobBase64) {
        const bin = atob(blobBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: f.mime || "application/octet-stream" });
      }
      return { ...f, text: f.text ?? "", notes: f.notes ?? "", ...(blob ? { blob } : {}) } as StoredFile;
    });
}

export function storageUsage(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      total += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
    return total;
  } catch {
    return 0;
  }
}
