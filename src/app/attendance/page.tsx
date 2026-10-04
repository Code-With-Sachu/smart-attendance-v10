"use client";

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, ClipboardCheck, FolderPlus, Hash, SearchX } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput, useDebounced, matches } from "@/components/ui/search";
import { Card, ColorDot } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useModuleActions } from "@/components/modules/module-actions";
import { lastRecordForSub, sortedMainModules, subModulesOf } from "@/lib/store/selectors";
import { relativeDay, todayISO } from "@/lib/format";
import { cn, tint } from "@/lib/utils";

function PickerInner() {
  const data = useAppData();
  const a = useModuleActions();
  const mainFilter = useSearchParams().get("main");
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q);
  if (!data) return null;

  const today = todayISO();
  const groups = sortedMainModules(data)
    .filter((m) => !mainFilter || m.id === mainFilter)
    .map((m) => ({ main: m, subs: subModulesOf(data, m.id).filter((s) => !dq.trim() || matches(s.name, dq) || matches(m.name, dq)) }))
    .filter((g) => g.subs.length > 0);
  const filteredMain = mainFilter ? data.mainModules.find((m) => m.id === mainFilter) : undefined;

  return (
    <>
      <PageHeader
        back={filteredMain ? { href: `/modules/${filteredMain.id}`, label: filteredMain.name } : undefined}
        title="Take Attendance"
        description={filteredMain ? `Choose a sub module in ${filteredMain.name}.` : "Choose the class and subject you’re teaching now."}
      />
      {data.subModules.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to take attendance for yet"
          description="Create a main module, add a sub module, then set its roll numbers."
          action={<Button onClick={data.mainModules.length ? () => a.createSub(data.mainModules[0]!.id) : a.createMain}><FolderPlus /> {data.mainModules.length ? "Create Sub Module" : "Create Main Module"}</Button>}
        />
      ) : (
        <>
          <SearchInput className="mb-6 max-w-md" value={q} onChange={setQ} placeholder="Search class or subject…" label="Search class or subject" />
          {groups.length === 0 ? (
            <EmptyState compact icon={SearchX} title="No matches" description="Try a different name." />
          ) : (
            <div className="space-y-6">
              {groups.map(({ main, subs }) => (
                <section key={main.id} aria-labelledby={`p-${main.id}`}>
                  <h2 id={`p-${main.id}`} className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                    <ColorDot color={main.color} /> {main.name}
                  </h2>
                  <Card className="divide-y divide-border overflow-hidden">
                    {subs.map((s) => {
                      const last = lastRecordForSub(data, s.id);
                      const ready = s.rollNumbers.length > 0;
                      const doneToday = last?.date === today;
                      return (
                        <Link
                          key={s.id}
                          href={ready ? `/attendance/${s.id}` : `/sub-modules/${s.id}/roll-numbers`}
                          className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular" style={{ backgroundColor: tint(s.color, 0.85), color: s.color }}>
                            {s.number}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-ink">{s.name}</p>
                            <p className="truncate text-xs text-ink-muted">
                              {ready ? `${s.rollNumbers.length} students` : "No roll numbers yet"}
                              {last ? ` · Last: ${relativeDay(last.date)}` : ""}
                            </p>
                          </div>
                          {doneToday && <span className="hidden rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success sm:inline">Taken today</span>}
                          <span className={cn("inline-flex items-center gap-1 text-sm font-medium", ready ? "text-primary-ink" : "text-ink-muted")}>
                            {ready ? <><span className="hidden sm:inline">Start</span><ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" /></> : <><Hash className="size-4" /><span className="hidden sm:inline">Set up</span></>}
                          </span>
                        </Link>
                      );
                    })}
                  </Card>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function AttendancePickerPage() {
  return (
    <Suspense>
      <PickerInner />
    </Suspense>
  );
}
