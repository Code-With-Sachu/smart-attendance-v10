"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FolderPlus, Hash, History, Pencil, Trash2, ListOrdered, CalendarClock, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreMenu } from "@/components/ui/dropdown";
import { useModuleActions } from "./module-actions";
import { percent, relativeDay } from "@/lib/format";
import { lastRecordForSub, recordRate, recordsOfSub } from "@/lib/store/selectors";
import { pluralize, tint } from "@/lib/utils";
import type { AppData, SubModule } from "@/lib/types";

export function SubModuleCard({ sub, data, showParent }: { sub: SubModule; data: AppData; showParent?: boolean }) {
  const router = useRouter();
  const a = useModuleActions();
  const parent = data.mainModules.find((m) => m.id === sub.mainModuleId);
  const records = recordsOfSub(data, sub.id);
  const last = lastRecordForSub(data, sub.id);
  const avg = records.length ? records.reduce((s, r) => s + recordRate(r), 0) / records.length : null;
  const hasRolls = sub.rollNumbers.length > 0;

  return (
    <Card className="group relative flex flex-col p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular" style={{ backgroundColor: tint(sub.color, 0.85), color: sub.color }}>
            {sub.number}
          </div>
          <div className="min-w-0">
            {showParent && parent && <p className="truncate text-xs font-medium text-ink-subtle">{parent.name}</p>}
            <h3 className="truncate text-base font-semibold text-ink">
              <Link href={`/sub-modules/${sub.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                {sub.name}
              </Link>
            </h3>
          </div>
        </div>
        <div className="relative z-10">
          <MoreMenu
            label={`More actions for ${sub.name}`}
            items={[
              { label: "Take Attendance", icon: ClipboardCheck, onSelect: () => router.push(hasRolls ? `/attendance/${sub.id}` : `/sub-modules/${sub.id}/roll-numbers`) },
              { label: "Edit", icon: Pencil, onSelect: () => a.editSub(sub) },
              { label: "Manage Roll Numbers", icon: Hash, onSelect: () => router.push(`/sub-modules/${sub.id}/roll-numbers`) },
              { label: "Attendance History", icon: History, onSelect: () => router.push(`/history?sub=${sub.id}`) },
              { label: "Create Sub Module", icon: FolderPlus, onSelect: () => a.createSub(sub.mainModuleId), separatorBefore: true },
              { label: "Delete", icon: Trash2, onSelect: () => a.deleteSub(sub), destructive: true, separatorBefore: true },
            ]}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat icon={ListOrdered} label="Students" value={String(sub.rollNumbers.length)} />
        <Stat icon={Percent} label="Average" value={avg === null ? "—" : percent(avg, 1, 0)} />
        <Stat icon={CalendarClock} label="Last taken" value={last ? relativeDay(last.date) : "—"} />
      </dl>

      <div className="relative z-10 mt-4">
        {hasRolls ? (
          <Button className="w-full" onClick={() => router.push(`/attendance/${sub.id}`)}>
            <ClipboardCheck /> Take Attendance
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => router.push(`/sub-modules/${sub.id}/roll-numbers`)}>
            <Hash /> Upload Students
          </Button>
        )}
      </div>
      <p className="sr-only">{pluralize(records.length, "class", "classes")} recorded</p>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <dt className="flex items-center justify-center gap-1 text-[11px] font-medium text-ink-subtle">
        <Icon className="size-3" aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-ink tabular">{value}</dd>
    </div>
  );
}
