import type { AppData } from "@/lib/types";
import type { StoredFile } from "@/lib/files/types";
import { KIND_LABEL } from "@/lib/files/types";
import { sheetToCsv } from "@/lib/files/extract";
import { byNewest, byNumber, recordRate, studentReportsForMain, mainOptionsWithHistory } from "@/lib/store/selectors";
import { formatRoll, formatTime, parseISODate, percent, rollWidth } from "@/lib/format";
import { recordNames } from "@/lib/names";
import { guideAsText } from "./guide";

const TOTAL_BUDGET = 380_000;
const FILES_BUDGET = 240_000;
const SESSIONS_BUDGET = 70_000;

const day = (iso: string) => parseISODate(iso).toLocaleDateString("en-GB", { weekday: "short" });

export function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter((w) => !STOP.has(w));
}
const STOP = new Set("the a an is are was were of to in on for and or with what who whom which how many much show me give list tell about my our this that these those please can you do does did from by at it its be all any".split(" "));

export function fileLocation(f: StoredFile, d: AppData): string {
  if (f.owner.kind === "profile") return "Profile → My files";
  const ownerSubId = f.owner.subModuleId;
  const sub = d.subModules.find((s) => s.id === ownerSubId);
  const main = sub ? d.mainModules.find((m) => m.id === sub.mainModuleId) : undefined;
  return sub ? `Sub module “${sub.name}” (${main?.name ?? ""})` : "Deleted sub module";
}

export function fileContent(f: StoredFile): string {
  const parts: string[] = [];
  if (f.notes.trim()) parts.push(`Notes: ${f.notes.trim()}`);
  if (f.sheets?.length) for (const s of f.sheets) parts.push(`[Sheet: ${s.name}]\n${sheetToCsv(s.rows)}`);
  if (f.text.trim()) parts.push(f.text.trim());
  if (!parts.length) parts.push(f.kind === "image" ? "(image — see attached image if provided)" : "(no readable text)");
  return parts.join("\n\n");
}

/** Score a file for a question: filename hits count most, then content hits. */
function scoreFile(f: StoredFile, words: string[]): number {
  if (!words.length) return 0;
  const name = f.name.toLowerCase();
  const body = (f.notes + " " + f.text.slice(0, 50_000) + " " + (f.sheets?.map((s) => s.rows.slice(0, 300).flat().join(" ")).join(" ") ?? "")).toLowerCase();
  let score = 0;
  for (const w of words) {
    if (name.includes(w)) score += 10;
    const hits = body.split(w).length - 1;
    score += Math.min(hits, 20);
  }
  return score;
}

export interface BuiltContext {
  text: string;
  /** Files whose content was included (for showing sources). */
  includedFiles: string[];
  /** Images (and scanned PDFs without text) worth sending to a multimodal model for this question. */
  images: StoredFile[];
}

/**
 * Build the knowledge the assistant answers from: how-to guide, current page, all
 * attendance data (per student and per session) and the content of uploaded files.
 * Everything is plain text so it works with any model and with the offline helper.
 */
export function buildContext(d: AppData, files: StoredFile[], question: string, page: string): BuiltContext {
  const out: string[] = [];
  const words = tokenize(question);
  const today = new Date();

  out.push(`# NOW\nToday: ${today.toDateString()} ${today.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. User is on page: ${page}`);
  out.push(`# APP GUIDE (how to use the website)\n${guideAsText()}`);

  const p = d.profile;
  out.push(
    `# TEACHER & SETTINGS\nName: ${p.name || "—"} · Subject: ${p.subject || "—"} · Teacher ID: ${p.teacherId || "—"}\nInstitution: ${d.settings.institutionName || "—"} · Low-attendance threshold: ${d.settings.lowThreshold}% · WhatsApp numbers saved: ${d.settings.whatsappContacts.map((c) => `${c.label || "no label"} ${c.number} (${c.send})`).join("; ") || "none"}`,
  );

  // ---- classes, subjects and per-student stats ----
  const cls: string[] = ["# CLASSES, SUBJECTS & STUDENT ATTENDANCE"];
  for (const m of mainOptionsWithHistory(d)) {
    const subs = d.subModules.filter((s) => s.mainModuleId === m.id).sort(byNumber);
    const recs = d.records.filter((r) => r.mainModuleId === m.id);
    cls.push(`\n## Main module (class): ${m.name} — ${subs.length} sub modules, ${recs.length} sessions recorded`);
    for (const s of subs) {
      const sr = recs.filter((r) => r.subModuleId === s.id);
      const avg = sr.length ? sr.reduce((a, r) => a + recordRate(r), 0) / sr.length : null;
      cls.push(`- Subject “${s.name}” (#${s.number}): ${s.rollNumbers.length} students, ${sr.length} classes taken, average ${avg === null ? "—" : percent(avg, 1)}${s.rosterSource ? `, list from ${s.rosterSource.fileName}` : ""} → /sub-modules/${s.id}`);
    }
    const reports = studentReportsForMain(d, m.id);
    if (reports.length) {
      const w = rollWidth(reports.map((r) => r.roll));
      cls.push(`Students of ${m.name} (Roll | Name | Overall present/total = % | per subject):`);
      for (const r of reports) {
        const subj = r.subjects
          .filter((x) => x.total)
          .map((x) => {
            const abs = x.sessions.filter((q) => q.status === "absent").map((q) => `${q.date}(${day(q.date)}) P${q.session} ${formatTime(q.takenAt)}`);
            return `${x.subName}: ${x.present}/${x.total}=${percent(x.present, x.total)}${abs.length ? ` absent on ${abs.join(", ")}` : ""}`;
          })
          .join(" ; ");
        const det = r.details ? ` [${Object.entries(r.details).slice(0, 6).map(([k, v]) => `${k}: ${v}`).join(", ")}]` : "";
        cls.push(`${formatRoll(r.roll, w)} | ${r.name || "—"}${det} | ${r.total ? `${r.present}/${r.total}=${percent(r.present, r.total)}` : "no classes yet"} | ${subj || "—"}`);
      }
    }
  }
  out.push(cls.join("\n"));

  // ---- sessions ----
  const sessions: string[] = ["# ATTENDANCE SESSIONS (newest first)"];
  let used = 0;
  const sorted = [...d.records].sort(byNewest);
  for (const r of sorted) {
    const names = recordNames(r);
    const w = rollWidth(r.rollNumbers);
    const abs = r.absent.map((n) => `${formatRoll(n, w)}${names[n] ? ` ${names[n]}` : ""}`).join(", ") || "none";
    const line = `- ${r.date} (${day(r.date)}) ${formatTime(r.takenAt)} period ${r.session} | ${r.mainModuleName} / ${r.subModuleName} | present ${r.present.length}/${r.rollNumbers.length} (${percent(r.present.length, r.rollNumbers.length)}) | absent: ${abs} → /history/${r.id}`;
    if (used + line.length > SESSIONS_BUDGET) {
      sessions.push(`…and ${sorted.length - sessions.length + 1} older sessions (summarised in student stats above).`);
      break;
    }
    used += line.length;
    sessions.push(line);
  }
  if (!d.records.length) sessions.push("No attendance submitted yet.");
  out.push(sessions.join("\n"));

  if (d.studentLists.length)
    out.push(`# SAVED STUDENT LISTS (Profile → Student details)\n${d.studentLists.map((l) => `- ${l.name}: ${l.students.length} students; columns ${l.columns.join(", ")}\n${l.students.slice(0, 300).map((s) => `  ${s.roll} ${s.name}${s.details ? ` (${Object.entries(s.details).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(", ")})` : ""}`).join("\n")}`).join("\n")}`);

  // ---- files (most relevant first, within budget) ----
  const includedFiles: string[] = [];
  const fileOut: string[] = [`# UPLOADED FILES (${files.length} total)`];
  if (!files.length) fileOut.push("No files uploaded yet.");
  fileOut.push(files.map((f) => `- “${f.name}” · ${KIND_LABEL[f.kind]} · ${fileLocation(f, d)} · uploaded ${f.createdAt.slice(0, 10)}${f.editCount ? `, edited ${f.updatedAt.slice(0, 10)}` : ""}`).join("\n"));
  const ranked = [...files].map((f) => ({ f, s: scoreFile(f, words) })).sort((a, b) => b.s - a.s || b.f.updatedAt.localeCompare(a.f.updatedAt));
  let fb = 0;
  for (const { f } of ranked) {
    const content = fileContent(f);
    const room = FILES_BUDGET - fb;
    if (room < 2000) break;
    const chunk = content.length > room ? content.slice(0, room) + "\n…[file truncated]" : content;
    fileOut.push(`\n=== FILE: “${f.name}” (${fileLocation(f, d)}) ===\n${chunk}\n=== END FILE ===`);
    includedFiles.push(f.name);
    fb += chunk.length;
  }
  out.push(fileOut.join("\n"));

  let text = out.join("\n\n");
  if (text.length > TOTAL_BUDGET) text = text.slice(0, TOTAL_BUDGET) + "\n…[context truncated]";

  const wantsImage = /image|photo|picture|pic|screenshot|scan|diagram|chart/i.test(question);
  const images = files
    .filter((f) => (f.kind === "image" || (f.kind === "pdf" && !f.text.trim())) && f.blob && f.size < 3_000_000)
    .map((f) => ({ f, s: scoreFile(f, words) }))
    .filter((x) => x.s > 0 || wantsImage)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.f);

  return { text, includedFiles, images };
}
