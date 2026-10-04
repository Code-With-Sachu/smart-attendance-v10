import type { AppData } from "@/lib/types";
import type { StoredFile } from "@/lib/files/types";
import { GUIDE } from "./guide";
import { fileContent, fileLocation, tokenize } from "./context";
import { byNewest, mainOptionsWithHistory, recordRate, studentReportsForMain, type StudentReport } from "@/lib/store/selectors";
import { formatLongDate, formatRoll, formatTime, percent, todayISO } from "@/lib/format";
import { recordNames } from "@/lib/names";

/**
 * Offline assistant — answers common questions straight from the data when no AI model is
 * configured or reachable. Not as flexible as the model, but always available and exact.
 */
export function localAnswer(q: string, d: AppData, files: StoredFile[]): string {
  const text = q.toLowerCase().trim();
  const words = tokenize(text);
  const low = d.settings.lowThreshold;

  if (!text) return helpMenu();
  if (/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(text))
    return `Hello${d.profile.name ? `, ${d.profile.name.split(" ")[0]}` : ""}! I can explain any section of the website, find a student’s attendance, list low attendance, summarise sessions and search your files.\n\n${helpMenu()}`;

  const all = allReports(d);

  // --- low attendance ---
  const below = text.match(/(?:below|under|less than|<)\s*(\d{1,3})\s*%?/);
  if (below || /\b(low|shortage|short|defaulter|at risk|risk|condonation)\b/.test(text)) {
    const t = below ? Number(below[1]) : low;
    const list = all.filter((r) => r.rate !== null && r.rate * 100 < t).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0));
    if (!list.length) return `Good news — no student is below **${t}%** overall.`;
    return `**${list.length} student${list.length === 1 ? "" : "s"} below ${t}%** (overall):\n\n| Class | Roll | Name | Attendance |\n|---|---|---|---|\n${list
      .slice(0, 60)
      .map((r) => `| ${r.mainName} | ${formatRoll(r.roll)} | [${r.name || "—"}](/history/student?main=${r.mainModuleId}&roll=${r.roll}) | ${percent(r.rate!, 1)} (${r.present}/${r.total}) |`)
      .join("\n")}\n\nSee all students in [Attendance History → Students](/history?view=students).`;
  }

  // --- a specific student (roll number or name) ---
  const rollMatch = text.match(/\broll\s*(?:no\.?|number)?\s*#?\s*(\d{1,4})\b/) ?? text.match(/^(\d{1,4})$/);
  let student: StudentReport | undefined;
  if (rollMatch) {
    const n = Number(rollMatch[1]);
    const cls = mainOptionsWithHistory(d).find((m) => text.includes(m.name.toLowerCase()));
    student = all.find((r) => r.roll === n && (!cls || r.mainModuleId === cls.id));
  } else {
    student = bestNameMatch(all, words);
  }
  if (student && (rollMatch || /attendance|percent|%|absent|present|report|how is|details|missed/.test(text) || student.name.toLowerCase().split(" ").some((p) => p.length > 2 && words.includes(p)))) {
    return studentAnswer(student, low);
  }

  // --- who was absent on a date ---
  const date = parseDate(text);
  if (date || /\b(absent|absentees|who was|who were)\b/.test(text)) {
    const target = date ?? todayISO();
    const recs = d.records.filter((r) => r.date === target).sort(byNewest);
    if (!recs.length) return `No attendance was recorded on **${formatLongDate(target)}**.`;
    return `**Attendance on ${formatLongDate(target)}**\n\n${recs
      .map((r) => {
        const names = recordNames(r);
        const abs = r.absent.map((n) => `${formatRoll(n)}${names[n] ? ` ${names[n]}` : ""}`).join(", ") || "none";
        return `- [${r.mainModuleName} / ${r.subModuleName}](/history/${r.id}) · ${formatTime(r.takenAt)} · period ${r.session} — ${r.present.length}/${r.rollNumbers.length} present (${percent(r.present.length, r.rollNumbers.length)})\n  Absent: ${abs}`;
      })
      .join("\n")}`;
  }

  // --- summary ---
  if (/\b(summary|overview|stats|statistics|total|how many|count|average)\b/.test(text)) {
    const avg = d.records.length ? d.records.reduce((s, r) => s + recordRate(r), 0) / d.records.length : null;
    const students = new Set(d.subModules.flatMap((s) => s.rollNumbers.map((n) => `${s.mainModuleId}:${n}`))).size;
    const lowCount = all.filter((r) => r.rate !== null && r.rate * 100 < low).length;
    return `**Overview**\n\n- Main modules: **${d.mainModules.length}**\n- Sub modules: **${d.subModules.length}**\n- Students: **${students}**\n- Attendance sessions: **${d.records.length}**\n- Average attendance: **${avg === null ? "—" : percent(avg, 1)}**\n- Students below ${low}%: **${lowCount}**\n- Uploaded files: **${files.length}**`;
  }

  // --- files ---
  if (/\b(file|files|document|pdf|sheet|excel|notes|upload|uploaded|syllabus|timetable|circular)\b/.test(text) || files.some((f) => words.some((w) => f.name.toLowerCase().includes(w)))) {
    if (!files.length) return "No files are uploaded yet. Add files in [Profile → My files](/profile#files) or in any sub module.";
    const hits = searchFiles(files, words);
    if (/\b(list|all|which|what) files\b/.test(text) || !hits.length) {
      return `**${files.length} uploaded file${files.length === 1 ? "" : "s"}:**\n\n${files.map((f) => `- **${f.name}** — ${fileLocation(f, d)}`).join("\n")}${!hits.length && words.length ? `\n\nI couldn’t find “${words.join(" ")}” inside them.` : ""}`;
    }
    return `**Found in your files:**\n\n${hits
      .slice(0, 6)
      .map((h) => `- **${h.file.name}** (${fileLocation(h.file, d)})\n  > ${h.snippet}`)
      .join("\n")}\n\n_For deeper analysis, enable the AI model (Admin → Overview → AI assistant)._`;
  }

  // --- how-to ---
  const topic = bestTopic(words);
  if (topic) return `**${topic.title}**\n\n${topic.body}\n\n[Open ${topic.title}](${topic.href})`;

  // --- last resort: search files ---
  const hits = searchFiles(files, words);
  if (hits.length) return `**Found in your files:**\n\n${hits.slice(0, 4).map((h) => `- **${h.file.name}**: ${h.snippet}`).join("\n")}`;

  return `I’m running in offline mode, so I can answer things like:\n\n${helpMenu()}`;
}

function helpMenu() {
  return [
    "- “How do I take attendance?” / “How does WhatsApp sharing work?”",
    "- “Attendance of roll 12” or “Anu’s attendance”",
    "- “Students below 75%”",
    "- “Who was absent today?” / “absent on 03-10-2026”",
    "- “Give me a summary”",
    "- “Search files for syllabus”",
  ].join("\n");
}

function allReports(d: AppData): StudentReport[] {
  return mainOptionsWithHistory(d).flatMap((m) => studentReportsForMain(d, m.id));
}

function bestNameMatch(all: StudentReport[], words: string[]): StudentReport | undefined {
  let best: StudentReport | undefined;
  let score = 0;
  for (const r of all) {
    if (!r.name) continue;
    const parts = r.name.toLowerCase().split(/\s+/);
    const s = parts.filter((p) => p.length > 1 && words.includes(p)).length;
    if (s > score) {
      score = s;
      best = r;
    }
  }
  return best;
}

function studentAnswer(r: StudentReport, low: number) {
  const lines = [
    `**${r.name || "Roll " + formatRoll(r.roll)}** · Roll ${formatRoll(r.roll)} · ${r.mainName}`,
    "",
    `Overall: **${r.rate === null ? "no classes yet" : `${percent(r.rate, 1)}`}** (${r.present} present / ${r.absent} absent of ${r.total})${r.rate !== null && r.rate * 100 < low ? ` ⚠️ below ${low}%` : ""}`,
    "",
    "| Subject | Present | Absent | % |",
    "|---|---|---|---|",
    ...r.subjects.map((s) => `| ${s.subName} | ${s.present} | ${s.absent} | ${s.rate === null ? "—" : percent(s.rate, 1)} |`),
  ];
  const absences = r.subjects.flatMap((s) => s.sessions.filter((x) => x.status === "absent").map((x) => `- ${formatLongDate(x.date)} · ${formatTime(x.takenAt)} · period ${x.session} — ${s.subName}`));
  if (absences.length) lines.push("", "**Absent on:**", ...absences.slice(-30));
  lines.push("", `[Open full report](/history/student?main=${r.mainModuleId}&roll=${r.roll})`);
  return lines.join("\n");
}

function parseDate(t: string): string | null {
  if (/\btoday\b/.test(t)) return todayISO();
  if (/\byesterday\b/.test(t)) return todayISO(new Date(Date.now() - 86_400_000));
  const iso = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
  const dmy = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (dmy) {
    const y = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  }
  return null;
}

function bestTopic(words: string[]) {
  let best: (typeof GUIDE)[number] | undefined;
  let score = 0;
  const joined = words.join(" ");
  for (const g of GUIDE) {
    let s = 0;
    for (const k of g.keywords) if (joined.includes(k)) s += k.includes(" ") ? 3 : 1;
    if (s > score) {
      score = s;
      best = g;
    }
  }
  return score > 0 ? best : undefined;
}

function searchFiles(files: StoredFile[], words: string[]) {
  const hits: { file: StoredFile; score: number; snippet: string }[] = [];
  const useful = words.filter((w) => !["file", "files", "search", "find", "document"].includes(w));
  if (!useful.length) return hits;
  for (const f of files) {
    const body = fileContent(f);
    const lower = body.toLowerCase();
    let score = 0;
    let first = -1;
    for (const w of useful) {
      const i = lower.indexOf(w);
      if (i >= 0) {
        score += 1 + Math.min(10, lower.split(w).length - 2);
        if (first < 0 || i < first) first = i;
      }
      if (f.name.toLowerCase().includes(w)) score += 5;
    }
    if (score > 0) {
      const start = Math.max(0, first - 80);
      const snippet = first >= 0 ? (start ? "…" : "") + body.slice(start, start + 220).replace(/\s+/g, " ").trim() + "…" : body.slice(0, 160).replace(/\s+/g, " ");
      hits.push({ file: f, score, snippet });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}
