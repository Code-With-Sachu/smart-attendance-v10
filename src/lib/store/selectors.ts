import type { AppData, AttendanceRecord, MainModule, SubModule } from "@/lib/types";

export const byNumber = <T extends { number: number; name: string }>(a: T, b: T) =>
  a.number - b.number || a.name.localeCompare(b.name);

export const byNewest = (a: AttendanceRecord, b: AttendanceRecord) =>
  b.date.localeCompare(a.date) || b.takenAt.localeCompare(a.takenAt);

export function sortedMainModules(d: AppData): MainModule[] {
  return [...d.mainModules].sort(byNumber);
}

export function subModulesOf(d: AppData, mainId: string): SubModule[] {
  return d.subModules.filter((s) => s.mainModuleId === mainId).sort(byNumber);
}

export function recordsOfSub(d: AppData, subId: string): AttendanceRecord[] {
  return d.records.filter((r) => r.subModuleId === subId).sort(byNewest);
}

export function lastRecordForMain(d: AppData, mainId: string): AttendanceRecord | undefined {
  return d.records.filter((r) => r.mainModuleId === mainId).sort(byNewest)[0];
}

export function lastRecordForSub(d: AppData, subId: string): AttendanceRecord | undefined {
  return recordsOfSub(d, subId)[0];
}

/** Unique students across a main module's sub modules (by roll number). */
export function studentCountForMain(d: AppData, mainId: string): number {
  const all = new Set<number>();
  d.subModules.filter((s) => s.mainModuleId === mainId).forEach((s) => s.rollNumbers.forEach((n) => all.add(n)));
  return all.size;
}

export const recordRate = (r: AttendanceRecord) => (r.rollNumbers.length ? r.present.length / r.rollNumbers.length : 0);

export interface SubStats {
  totalClasses: number;
  average: number | null;
  highest: AttendanceRecord | null;
  lowest: AttendanceRecord | null;
  perRoll: { roll: number; present: number; absent: number; total: number; rate: number | null }[];
}

export function subModuleStats(d: AppData, sub: SubModule): SubStats {
  const records = recordsOfSub(d, sub.id);
  const totalClasses = records.length;
  const average = totalClasses ? records.reduce((s, r) => s + recordRate(r), 0) / totalClasses : null;
  let highest: AttendanceRecord | null = null;
  let lowest: AttendanceRecord | null = null;
  for (const r of records) {
    if (!highest || recordRate(r) > recordRate(highest)) highest = r;
    if (!lowest || recordRate(r) < recordRate(lowest)) lowest = r;
  }
  const rolls = new Set<number>(sub.rollNumbers);
  records.forEach((r) => r.rollNumbers.forEach((n) => rolls.add(n)));
  const perRoll = [...rolls]
    .sort((a, b) => a - b)
    .map((roll) => {
      let present = 0;
      let absent = 0;
      for (const r of records) {
        if (r.present.includes(roll)) present++;
        else if (r.absent.includes(roll)) absent++;
      }
      const total = present + absent;
      return { roll, present, absent, total, rate: total ? present / total : null };
    });
  return { totalClasses, average, highest, lowest, perRoll };
}

/* ------------------------------------------------------------------ */
/* Student-level analytics (Attendance History → Students)            */
/* ------------------------------------------------------------------ */

const chrono = (a: AttendanceRecord, b: AttendanceRecord) => a.date.localeCompare(b.date) || a.takenAt.localeCompare(b.takenAt);

/**
 * Each student's overall rate in a sub module, counting only records up to and including
 * `upTo` (when given). Used to show "percentage of each student" on a record.
 */
export function rollRatesForSub(d: AppData, subId: string, opts: { upTo?: AttendanceRecord; exclude?: string; extra?: { rolls: number[]; absent: number[] } } = {}): Record<number, number | null> {
  let records = d.records.filter((r) => r.subModuleId === subId && r.id !== opts.exclude);
  if (opts.upTo) records = records.filter((r) => chrono(r, opts.upTo!) <= 0);
  const present = new Map<number, number>();
  const total = new Map<number, number>();
  const add = (roll: number, isPresent: boolean) => {
    total.set(roll, (total.get(roll) ?? 0) + 1);
    if (isPresent) present.set(roll, (present.get(roll) ?? 0) + 1);
  };
  for (const r of records) {
    r.present.forEach((n) => add(n, true));
    r.absent.forEach((n) => add(n, false));
  }
  if (opts.extra) {
    const abs = new Set(opts.extra.absent);
    opts.extra.rolls.forEach((n) => add(n, !abs.has(n)));
  }
  const out: Record<number, number | null> = {};
  for (const [roll, t] of total) out[roll] = t ? (present.get(roll) ?? 0) / t : null;
  return out;
}

export interface StudentSession {
  recordId: string;
  date: string;
  takenAt: string;
  session: number;
  status: "present" | "absent";
}

export interface StudentSubjectReport {
  subModuleId: string;
  subName: string;
  present: number;
  absent: number;
  total: number;
  rate: number | null;
  sessions: StudentSession[];
}

export interface StudentReport {
  mainModuleId: string;
  mainName: string;
  roll: number;
  name: string;
  details?: Record<string, string>;
  present: number;
  absent: number;
  total: number;
  rate: number | null;
  subjects: StudentSubjectReport[];
}

/** Latest known name for a roll in a main module (current roster first, then records). */
export function studentName(d: AppData, mainId: string, roll: number): string {
  for (const s of d.subModules.filter((x) => x.mainModuleId === mainId)) {
    const st = s.students?.find((x) => x.roll === roll && x.name);
    if (st) return st.name;
  }
  const rec = [...d.records].filter((r) => r.mainModuleId === mainId && r.names?.[String(roll)]).sort(byNewest)[0];
  return rec?.names?.[String(roll)] ?? "";
}

function studentDetails(d: AppData, mainId: string, roll: number) {
  for (const s of d.subModules.filter((x) => x.mainModuleId === mainId)) {
    const st = s.students?.find((x) => x.roll === roll);
    if (st?.details) return st.details;
  }
  return undefined;
}

export function studentReport(d: AppData, mainId: string, roll: number): StudentReport {
  const records = d.records.filter((r) => r.mainModuleId === mainId && r.rollNumbers.includes(roll)).sort(chrono);
  const bySub = new Map<string, StudentSubjectReport>();
  for (const r of records) {
    const cur = bySub.get(r.subModuleId) ?? {
      subModuleId: r.subModuleId,
      subName: d.subModules.find((s) => s.id === r.subModuleId)?.name ?? r.subModuleName,
      present: 0,
      absent: 0,
      total: 0,
      rate: null,
      sessions: [],
    };
    const status = r.absent.includes(roll) ? "absent" : "present";
    cur[status]++;
    cur.total++;
    cur.sessions.push({ recordId: r.id, date: r.date, takenAt: r.takenAt, session: r.session, status });
    bySub.set(r.subModuleId, cur);
  }
  const subjects = [...bySub.values()].map((s) => ({ ...s, rate: s.total ? s.present / s.total : null }));
  // Include subjects of this class that have no records yet, so the report lists every subject.
  for (const s of d.subModules.filter((x) => x.mainModuleId === mainId && x.rollNumbers.includes(roll)).sort(byNumber)) {
    if (!bySub.has(s.id)) subjects.push({ subModuleId: s.id, subName: s.name, present: 0, absent: 0, total: 0, rate: null, sessions: [] });
  }
  const order = (id: string) => d.subModules.find((s) => s.id === id)?.number ?? 9999;
  subjects.sort((a, b) => order(a.subModuleId) - order(b.subModuleId) || a.subName.localeCompare(b.subName));
  const present = subjects.reduce((a, s) => a + s.present, 0);
  const absent = subjects.reduce((a, s) => a + s.absent, 0);
  const main = d.mainModules.find((m) => m.id === mainId);
  return {
    mainModuleId: mainId,
    mainName: main?.name ?? records[records.length - 1]?.mainModuleName ?? "",
    roll,
    name: studentName(d, mainId, roll),
    details: studentDetails(d, mainId, roll),
    present,
    absent,
    total: present + absent,
    rate: present + absent ? present / (present + absent) : null,
    subjects,
  };
}

/** Every student (roll) seen in a main module, current roster or history. */
export function rollsOfMain(d: AppData, mainId: string): number[] {
  const set = new Set<number>();
  d.subModules.filter((s) => s.mainModuleId === mainId).forEach((s) => s.rollNumbers.forEach((n) => set.add(n)));
  d.records.filter((r) => r.mainModuleId === mainId).forEach((r) => r.rollNumbers.forEach((n) => set.add(n)));
  return [...set].sort((a, b) => a - b);
}

export function studentReportsForMain(d: AppData, mainId: string): StudentReport[] {
  return rollsOfMain(d, mainId).map((roll) => studentReport(d, mainId, roll));
}

/** Main modules that exist or still have history (deleted ones get a "(deleted)" label). */
export function mainOptionsWithHistory(d: AppData): { id: string; name: string }[] {
  const out = new Map<string, string>();
  sortedMainModules(d).forEach((m) => out.set(m.id, m.name));
  d.records.forEach((r) => !out.has(r.mainModuleId) && out.set(r.mainModuleId, `${r.mainModuleName} (deleted)`));
  return [...out].map(([id, name]) => ({ id, name }));
}
