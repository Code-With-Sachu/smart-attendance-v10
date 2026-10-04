"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatRoll, formatShortDate, percent, rollWidth } from "@/lib/format";
import { recordRate, type SubStats } from "@/lib/store/selectors";
import type { AttendanceRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const LOW_THRESHOLD = 0.75;

export function StatTiles({ stats }: { stats: SubStats }) {
  const tiles = [
    { label: "Total Classes", value: String(stats.totalClasses) },
    { label: "Average Attendance", value: stats.average === null ? "—" : percent(stats.average, 1) },
    { label: "Highest", value: stats.highest ? percent(recordRate(stats.highest), 1) : "—", sub: stats.highest ? formatShortDate(stats.highest.date) : undefined, href: stats.highest ? `/history/${stats.highest.id}` : undefined },
    { label: "Lowest", value: stats.lowest ? percent(recordRate(stats.lowest), 1) : "—", sub: stats.lowest ? formatShortDate(stats.lowest.date) : undefined, href: stats.lowest ? `/history/${stats.lowest.id}` : undefined },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => {
        const body = (
          <>
            <p className="text-xs font-medium text-ink-muted">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">{t.value}</p>
            {t.sub && <p className="mt-0.5 text-xs text-ink-subtle">{t.sub}</p>}
          </>
        );
        return t.href ? (
          <Link key={t.label} href={t.href} className="rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-pop">
            {body}
          </Link>
        ) : (
          <Card key={t.label} className="p-4">
            {body}
          </Card>
        );
      })}
    </div>
  );
}

/** Simple accessible column chart of attendance % for the most recent sessions. */
export function AttendanceTrend({ records }: { records: AttendanceRecord[] }) {
  const recent = records.slice(0, 14).reverse();
  if (recent.length < 2) return null;
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-ink">Attendance trend</h3>
      <p className="text-xs text-ink-muted">Last {recent.length} sessions</p>
      <div className="mt-4 flex h-36 items-end justify-center gap-1.5 sm:gap-2" role="list" aria-label="Attendance percentage by session">
        {recent.map((r) => {
          const rate = recordRate(r);
          return (
            <Link
              key={r.id}
              href={`/history/${r.id}`}
              role="listitem"
              aria-label={`${formatShortDate(r.date)}: ${percent(rate, 1)} present`}
              title={`${formatShortDate(r.date)} · ${percent(rate, 1)}`}
              className="group flex h-full max-w-10 flex-1 flex-col justify-end"
            >
              <div
                className={cn("w-full rounded-t-[4px] transition-colors", rate < LOW_THRESHOLD ? "bg-absent-border group-hover:bg-absent-strong" : "bg-primary/70 group-hover:bg-primary")}
                style={{ height: `${Math.max(4, rate * 100)}%` }}
              />
            </Link>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-subtle">
        <span>{formatShortDate(recent[0]!.date)}</span>
        <span>{formatShortDate(recent[recent.length - 1]!.date)}</span>
      </div>
    </Card>
  );
}

export function PerStudentTable({ stats, names }: { stats: SubStats; names?: Record<number, string> }) {
  const withNames = !!names && Object.keys(names).length > 0;
  if (!stats.totalClasses) return null;
  const width = rollWidth(stats.perRoll.map((r) => r.roll));
  const low = stats.perRoll.filter((r) => r.rate !== null && r.rate < LOW_THRESHOLD).length;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Student attendance</h3>
          <p className="text-xs text-ink-muted">
            {low > 0 ? `${low} below ${LOW_THRESHOLD * 100}%` : `Everyone at or above ${LOW_THRESHOLD * 100}%`}
          </p>
        </div>
      </div>
      <div className="max-h-[420px] overflow-auto border-t border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium text-ink-muted">
            <tr>
              <th scope="col" className="px-5 py-2">Roll No.</th>
              {withNames && <th scope="col" className="px-3 py-2">Name</th>}
              <th scope="col" className="px-3 py-2 text-right">Present</th>
              <th scope="col" className="px-3 py-2 text-right">Absent</th>
              <th scope="col" className="px-5 py-2 text-right">Attendance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular">
            {stats.perRoll.map((r) => {
              const isLow = r.rate !== null && r.rate < LOW_THRESHOLD;
              return (
                <tr key={r.roll} className={cn(isLow && "bg-absent-bg/40")}>
                  <th scope="row" className="px-5 py-2 text-left font-medium text-ink">{formatRoll(r.roll, width)}</th>
                  {withNames && <td className="max-w-[180px] truncate px-3 py-2 text-ink">{names?.[r.roll] ?? ""}</td>}
                  <td className="px-3 py-2 text-right text-ink-muted">{r.present}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">{r.absent}</td>
                  <td className="px-5 py-2 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:block" aria-hidden>
                        <span className={cn("block h-full rounded-full", isLow ? "bg-absent-strong" : "bg-primary")} style={{ width: `${(r.rate ?? 0) * 100}%` }} />
                      </span>
                      <span className={cn("w-14 font-medium", isLow ? "text-absent-ink" : "text-ink")}>
                        {r.rate === null ? "—" : percent(r.rate, 1)}
                      </span>
                      {isLow && <span className="sr-only">(below threshold)</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
