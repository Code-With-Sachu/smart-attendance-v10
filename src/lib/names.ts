import type { AttendanceRecord, Student } from "@/lib/types";

export type NameMap = Record<number, string>;

/** roll → name for a sub module's students (only rolls that have a name). */
export function studentNames(students?: Student[]): NameMap {
  const out: NameMap = {};
  for (const s of students ?? []) if (s.name) out[s.roll] = s.name;
  return out;
}

/** roll → name stored on an attendance record. */
export function recordNames(r: AttendanceRecord): NameMap {
  const out: NameMap = {};
  for (const [k, v] of Object.entries(r.names ?? {})) if (v) out[Number(k)] = v;
  return out;
}

export const hasAnyName = (names?: NameMap) => !!names && Object.keys(names).length > 0;
