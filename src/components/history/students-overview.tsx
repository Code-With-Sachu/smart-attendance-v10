"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Download, SearchX, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput, useDebounced, matches } from "@/components/ui/search";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRoll, percent, rollWidth } from "@/lib/format";
import { mainOptionsWithHistory, studentReportsForMain } from "@/lib/store/selectors";
import { downloadText, safeFileName } from "@/lib/report";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

const selectCls = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink shadow-sm";

/** Attendance History → Students: every student's overall and per-subject percentage. */
export function StudentsOverview({ data, initialMain }: { data: AppData; initialMain?: string }) {
  const mains = mainOptionsWithHistory(data);
  const [main, setMain] = React.useState(initialMain && mains.some((m) => m.id === initialMain) ? initialMain : mains[0]?.id ?? "");
  const [q, setQ] = React.useState("");
  const [onlyLow, setOnlyLow] = React.useState(false);
  const dq = useDebounced(q);
  const low = data.settings.lowThreshold / 100;

  const reports = React.useMemo(() => (main ? studentReportsForMain(data, main) : []), [data, main]);
  if (!mains.length) return <EmptyState icon={Users} title="No classes yet" description="Create a main module and take attendance to see student reports." />;

  const subjects = Array.from(new Map(reports.flatMap((r) => r.subjects.map((s) => [s.subModuleId, s.subName] as const))).entries());
  const width = rollWidth(reports.map((r) => r.roll));
  const filtered = reports
    .filter((r) => !dq.trim() || matches(r.name, dq) || String(r.roll) === dq.trim() || formatRoll(r.roll, width) === dq.trim())
    .filter((r) => !onlyLow || (r.rate !== null && r.rate < low));
  const lowCount = reports.filter((r) => r.rate !== null && r.rate < low).length;

  function exportCsv() {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const head = ["Roll No", "Name", "Overall %", "Present", "Absent", "Total", ...subjects.flatMap(([, n]) => [`${n} %`, `${n} P/T`])];
    const rows = reports.map((r) => [
      formatRoll(r.roll, width),
      r.name,
      r.rate === null ? "" : (r.rate * 100).toFixed(1),
      String(r.present),
      String(r.absent),
      String(r.total),
      ...subjects.flatMap(([id]) => {
        const s = r.subjects.find((x) => x.subModuleId === id);
        return [s?.rate == null ? "" : (s.rate * 100).toFixed(1), s ? `${s.present}/${s.total}` : ""];
      }),
    ]);
    const name = mains.find((m) => m.id === main)?.name ?? "class";
    downloadText([head, ...rows].map((r) => r.map(esc).join(",")).join("\n"), `${safeFileName(`students-${name}`)}.csv`, "text/csv;charset=utf-8");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[220px_1fr_auto] sm:items-center">
        <div>
          <label htmlFor="st-main" className="sr-only">Class (main module)</label>
          <select id="st-main" className={selectCls} value={main} onChange={(e) => setMain(e.target.value)}>
            {mains.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search by name or roll number…" label="Search students" />
        <div className="flex gap-2">
          <Button variant={onlyLow ? "primary" : "secondary"} size="md" onClick={() => setOnlyLow((v) => !v)} aria-pressed={onlyLow}>
            Below {data.settings.lowThreshold}% <span className="rounded bg-black/10 px-1.5 text-xs tabular">{lowCount}</span>
          </Button>
          <Button variant="secondary" size="md" onClick={exportCsv} disabled={!reports.length} aria-label="Download CSV">
            <Download />
          </Button>
        </div>
      </div>

      {reports.length === 0 ? (
        <EmptyState compact icon={Users} title="No students in this class" description="Upload a student list in Manage Roll Numbers." />
      ) : filtered.length === 0 ? (
        <EmptyState compact icon={SearchX} title="No students match" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5">Roll</th>
                  <th scope="col" className="px-3 py-2.5">Name</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Overall</th>
                  {subjects.map(([id, n]) => (
                    <th key={id} scope="col" className="max-w-[120px] truncate px-3 py-2.5 text-right" title={n}>{n}</th>
                  ))}
                  <th className="w-8" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular">
                {filtered.map((r) => {
                  const isLow = r.rate !== null && r.rate < low;
                  const href = `/history/student?main=${encodeURIComponent(main)}&roll=${r.roll}`;
                  return (
                    <tr key={r.roll} className={cn("group cursor-pointer hover:bg-slate-50", isLow && "bg-danger-soft/40")}>
                      <td className="px-4 py-2 font-semibold text-ink"><Link href={href} className="block">{formatRoll(r.roll, width)}</Link></td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-ink"><Link href={href} className="block">{r.name || <span className="text-ink-subtle">No name</span>}</Link></td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", isLow ? "bg-danger-soft text-danger" : r.rate === null ? "text-ink-subtle" : "bg-success-soft text-success-ink")}>
                          {r.rate === null ? "—" : percent(r.rate, 1)}
                        </span>
                      </td>
                      {subjects.map(([id]) => {
                        const s = r.subjects.find((x) => x.subModuleId === id);
                        const sl = s?.rate != null && s.rate < low;
                        return (
                          <td key={id} className={cn("px-3 py-2 text-right", sl ? "text-danger" : "text-ink-muted")} title={s ? `${s.present}/${s.total} present` : ""}>
                            {s?.rate == null ? "—" : percent(s.rate, 1, 0)}
                          </td>
                        );
                      })}
                      <td className="pr-3"><Link href={href} aria-label={`Open report for roll ${r.roll}`}><ChevronRight className="size-4 text-ink-subtle" /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
