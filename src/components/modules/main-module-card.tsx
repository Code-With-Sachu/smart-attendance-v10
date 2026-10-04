"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Copy, FolderOpen, FolderPlus, Pencil, Trash2, CalendarClock, FolderTree, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreMenu } from "@/components/ui/dropdown";
import { useModuleActions } from "./module-actions";
import { relativeDay } from "@/lib/format";
import { lastRecordForMain, studentCountForMain } from "@/lib/store/selectors";
import { pluralize } from "@/lib/utils";
import type { AppData, MainModule } from "@/lib/types";

export function MainModuleCard({ mod, data }: { mod: MainModule; data: AppData }) {
  const router = useRouter();
  const a = useModuleActions();
  const subCount = data.subModules.filter((s) => s.mainModuleId === mod.id).length;
  const students = studentCountForMain(data, mod.id);
  const last = lastRecordForMain(data, mod.id);

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-pop">
      <div className="h-1.5 w-full" style={{ backgroundColor: mod.color }} aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-medium text-ink-subtle tabular">#{mod.number}</span>
            <h3 className="truncate text-lg font-semibold tracking-tight text-ink">
              <Link href={`/modules/${mod.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                {mod.name}
              </Link>
            </h3>
          </div>
          <div className="relative z-10">
            <MoreMenu
              label={`More actions for ${mod.name}`}
              items={[
                { label: "Open", icon: FolderOpen, onSelect: () => router.push(`/modules/${mod.id}`) },
                { label: "Take Attendance", icon: ClipboardCheck, onSelect: () => a.takeAttendanceForMain(mod), disabled: subCount === 0 },
                { label: "Create Sub Module", icon: FolderPlus, onSelect: () => a.createSub(mod.id) },
                { label: "Edit", icon: Pencil, onSelect: () => a.editMain(mod), separatorBefore: true },
                { label: "Duplicate", icon: Copy, onSelect: () => a.duplicateMain(mod) },
                { label: "Delete", icon: Trash2, onSelect: () => a.deleteMain(mod), destructive: true, separatorBefore: true },
              ]}
            />
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-ink-muted">
            <FolderTree className="size-4 text-ink-subtle" aria-hidden />
            <dt className="sr-only">Sub modules</dt>
            <dd>{pluralize(subCount, "Sub Module")}</dd>
          </div>
          <div className="flex items-center gap-2 text-ink-muted">
            <Users className="size-4 text-ink-subtle" aria-hidden />
            <dt className="sr-only">Students</dt>
            <dd>{pluralize(students, "Student")}</dd>
          </div>
          <div className="flex items-center gap-2 text-ink-muted">
            <CalendarClock className="size-4 text-ink-subtle" aria-hidden />
            <dt className="sr-only">Last attendance</dt>
            <dd>Last attendance: <span className="text-ink">{last ? relativeDay(last.date) : "Never"}</span></dd>
          </div>
        </dl>

        <div className="relative z-10 mt-5">
          {subCount > 0 ? (
            <Button variant="secondary" className="w-full" onClick={() => a.takeAttendanceForMain(mod)}>
              <ClipboardCheck /> Take Attendance
            </Button>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => a.createSub(mod.id)}>
              <FolderPlus /> Add a Sub Module
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
