import type { TakerContext } from "@/components/attendance/attendance-taker";
import type { AppData } from "@/lib/types";
import { recordNames, studentNames } from "@/lib/names";

export function resolveContext(data: AppData, subId: string, editId: string | null): TakerContext | { error: "missing-sub" | "missing-record" | "no-rolls" } {
  if (editId) {
    const rec = data.records.find((r) => r.id === editId);
    if (!rec) return { error: "missing-record" };
    const sub = data.subModules.find((s) => s.id === rec.subModuleId);
    return { subModuleId: rec.subModuleId, mainName: rec.mainModuleName, subName: rec.subModuleName, color: sub?.color ?? "#6366F1", rolls: rec.rollNumbers, names: recordNames(rec), editing: rec };
  }
  const sub = data.subModules.find((s) => s.id === subId);
  if (!sub) return { error: "missing-sub" };
  if (!sub.rollNumbers.length) return { error: "no-rolls" };
  const main = data.mainModules.find((m) => m.id === sub.mainModuleId);
  return { subModuleId: sub.id, mainName: main?.name ?? "", subName: sub.name, color: sub.color, rolls: sub.rollNumbers, names: studentNames(sub.students) };
}

