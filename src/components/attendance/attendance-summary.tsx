import { percent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AttendanceSummary({ total, absent, className }: { total: number; absent: number; className?: string }) {
  const present = total - absent;
  const items = [
    { label: "Total Students", value: total, cls: "text-ink" },
    { label: "Present", value: present, cls: "text-ink" },
    { label: "Absent", value: absent, cls: "text-absent-strong" },
    { label: "Attendance", value: percent(present, total), cls: "text-primary-ink" },
  ];
  return (
    <dl className={cn("grid grid-cols-4 divide-x divide-border rounded-xl border border-border bg-card shadow-card", className)} aria-live="polite">
      {items.map((i) => (
        <div key={i.label} className="px-2 py-3 text-center sm:px-4">
          <dt className="truncate text-[11px] font-medium text-ink-muted sm:text-xs">{i.label}</dt>
          <dd className={cn("mt-0.5 text-lg font-semibold tabular sm:text-xl", i.cls)}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
