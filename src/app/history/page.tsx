"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterX, History as HistoryIcon, SlidersHorizontal } from "lucide-react";
import { useAppData } from "@/lib/store/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { RecordRow } from "@/components/attendance/record-row";
import { StudentsOverview } from "@/components/history/students-overview";
import { ClipboardList, Users } from "lucide-react";
import { byNewest, sortedMainModules, subModulesOf } from "@/lib/store/selectors";
import { parsePositiveInt } from "@/lib/validation";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const selectCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink shadow-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0";

function HistoryInner() {
  const data = useAppData();
  const router = useRouter();
  const params = useSearchParams();

  const [main, setMain] = React.useState("");
  const [sub, setSub] = React.useState(params.get("sub") ?? "");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [roll, setRoll] = React.useState("");
  const [status, setStatus] = React.useState<"absent" | "present">("absent");
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const [showFilters, setShowFilters] = React.useState(false);

  // Preselect main module when arriving via ?sub=
  React.useEffect(() => {
    const s = params.get("sub");
    if (s && data) {
      const sm = data.subModules.find((x) => x.id === s);
      const rec = data.records.find((r) => r.subModuleId === s);
      setMain(sm?.mainModuleId ?? rec?.mainModuleId ?? "");
      setSub(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, !!data]);

  React.useEffect(() => setLimit(PAGE_SIZE), [main, sub, from, to, roll, status]);

  const view = params.get("view") === "students" ? "students" : "sessions";
  if (!data) return null;

  const tabs = (
    <div role="tablist" aria-label="History view" className="mb-5 inline-flex rounded-xl border border-border bg-slate-50 p-1">
      {([
        ["sessions", "Attendance Sessions", ClipboardList],
        ["students", "Students", Users],
      ] as const).map(([v, label, Icon]) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          onClick={() => router.replace(v === "students" ? "/history?view=students" : "/history")}
          className={cn("inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors", view === v ? "bg-card text-ink shadow-sm" : "text-ink-muted hover:text-ink")}
        >
          <Icon className="size-4" aria-hidden /> {label}
        </button>
      ))}
    </div>
  );

  if (view === "students")
    return (
      <>
        <PageHeader title="Attendance History" description="Each student’s overall and subject-wise attendance, with absent and present dates." />
        {tabs}
        <StudentsOverview data={data} initialMain={params.get("main") ?? undefined} />
      </>
    );

  // Options include modules that were deleted but still have history (by snapshot name).
  const mainOptions = new Map<string, string>();
  sortedMainModules(data).forEach((m) => mainOptions.set(m.id, m.name));
  data.records.forEach((r) => !mainOptions.has(r.mainModuleId) && mainOptions.set(r.mainModuleId, `${r.mainModuleName} (deleted)`));
  const subOptions = new Map<string, string>();
  if (main) {
    subModulesOf(data, main).forEach((s) => subOptions.set(s.id, s.name));
    data.records.filter((r) => r.mainModuleId === main).forEach((r) => !subOptions.has(r.subModuleId) && subOptions.set(r.subModuleId, `${r.subModuleName} (deleted)`));
  }

  const rollN = roll.trim() ? parsePositiveInt(roll) : null;
  const rollInvalid = roll.trim() !== "" && rollN === null;

  const filtered = [...data.records]
    .filter((r) => !main || r.mainModuleId === main)
    .filter((r) => !sub || r.subModuleId === sub)
    .filter((r) => !from || r.date >= from)
    .filter((r) => !to || r.date <= to)
    .filter((r) => rollN === null || (status === "absent" ? r.absent : r.present).includes(rollN))
    .sort(byNewest);

  const active = [main, sub, from, to, roll].filter(Boolean).length;
  const clear = () => {
    setMain("");
    setSub("");
    setFrom("");
    setTo("");
    setRoll("");
    router.replace("/history");
  };

  return (
    <>
      <PageHeader
        title="Attendance History"
        description={`${data.records.length} attendance session${data.records.length === 1 ? "" : "s"} saved · open one for the full absent / present lists`}
        actions={
          data.records.length > 0 && (
            <Button variant="secondary" className="lg:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="history-filters">
              <SlidersHorizontal /> Filters {active > 0 && <span className="rounded bg-primary px-1.5 text-xs text-white">{active}</span>}
            </Button>
          )
        }
      />

      {tabs}
      {data.records.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="No Attendance Records" description="Attendance records will appear here after you submit your first session." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Card id="history-filters" className={cn("h-fit space-y-4 p-4 lg:sticky lg:top-24 lg:block", !showFilters && "hidden")}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Filters</h2>
              {active > 0 && (
                <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:underline">
                  <FilterX className="size-3.5" /> Clear
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="f-main" className="text-xs font-medium text-ink-muted">Main Module</label>
              <select id="f-main" className={selectCls} value={main} onChange={(e) => { setMain(e.target.value); setSub(""); }}>
                <option value="">All modules</option>
                {[...mainOptions].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="f-sub" className="text-xs font-medium text-ink-muted">Sub Module</label>
              <select id="f-sub" className={selectCls} value={sub} onChange={(e) => setSub(e.target.value)} disabled={!main}>
                <option value="">{main ? "All sub modules" : "Select a main module first"}</option>
                {[...subOptions].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label htmlFor="f-from" className="text-xs font-medium text-ink-muted">From</label>
                <Input id="f-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="px-2 text-xs" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="f-to" className="text-xs font-medium text-ink-muted">To</label>
                <Input id="f-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="px-2 text-xs" />
              </div>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-ink-muted">Student status</legend>
              <div className="flex gap-2">
                <Input aria-label="Roll number" inputMode="numeric" placeholder="Roll no." value={roll} onChange={(e) => setRoll(e.target.value)} invalid={rollInvalid} className="w-24 tabular" />
                <select aria-label="Status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as "absent" | "present")}>
                  <option value="absent">was Absent</option>
                  <option value="present">was Present</option>
                </select>
              </div>
              {rollInvalid && <p className="text-xs text-danger">Enter a positive whole number.</p>}
            </fieldset>
          </Card>

          <div>
            <p className="mb-2 text-sm text-ink-muted" aria-live="polite">
              {filtered.length === data.records.length ? `Showing all ${filtered.length}` : `${filtered.length} of ${data.records.length} match`}
            </p>
            {filtered.length === 0 ? (
              <EmptyState compact icon={FilterX} title="No records match these filters" action={<Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button>} />
            ) : (
              <>
                <Card className="divide-y divide-border overflow-hidden">
                  {filtered.slice(0, limit).map((r) => (
                    <RecordRow key={r.id} r={r} />
                  ))}
                </Card>
                {filtered.length > limit && (
                  <div className="mt-4 text-center">
                    <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                      Load more ({filtered.length - limit} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryInner />
    </Suspense>
  );
}
