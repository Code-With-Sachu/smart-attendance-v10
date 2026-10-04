import { formatRoll, percent, rollWidth } from "@/lib/format";
import { cn } from "@/lib/utils";

function RatePill({ rate, low }: { rate: number | null | undefined; low: number }) {
  if (rate === undefined || rate === null) return null;
  const isLow = rate < low;
  return (
    <span
      title="Overall attendance in this subject"
      className={cn(
        "ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular",
        isLow ? "bg-danger-soft text-danger" : "bg-success-soft text-success-ink",
      )}
    >
      {percent(rate, 1, 0)}
      {isLow && <span className="sr-only"> (below threshold)</span>}
    </span>
  );
}

/**
 * Read-only list of students (review + detail pages). Shows names when the class has them
 * and, when `rates` is given, each student's overall attendance % in this subject.
 */
export function RollList({
  rolls,
  all,
  variant,
  emptyText,
  names,
  rates,
  lowThreshold = 75,
}: {
  rolls: number[];
  all: number[];
  variant: "absent" | "present";
  emptyText: string;
  names?: Record<number, string>;
  rates?: Record<number, number | null>;
  lowThreshold?: number;
}) {
  const width = rollWidth(all);
  const low = lowThreshold / 100;
  if (!rolls.length) return <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-ink-muted">{emptyText}</p>;
  const status = variant === "absent" ? "Absent" : "Present";
  const withNames = !!names && Object.keys(names).length > 0;

  if (withNames || rates)
    return (
      <ol className="grid gap-1.5 sm:grid-cols-2">
        {rolls.map((n) => (
          <li
            key={n}
            aria-label={`Roll ${formatRoll(n, width)} ${names?.[n] ?? ""} — ${status}${rates?.[n] != null ? `, overall ${percent(rates[n]!, 1, 0)}` : ""}`}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border py-1.5 pl-1.5 pr-2 text-sm",
              variant === "absent" ? "border-absent-border/60 bg-absent-bg text-absent-ink" : "border-border bg-card text-ink",
            )}
          >
            <span className={cn("grid h-7 min-w-9 shrink-0 place-items-center rounded-md px-1 text-xs font-bold tabular", variant === "absent" ? "bg-absent-border/25" : "bg-slate-100")}>
              {formatRoll(n, width)}
            </span>
            <span className="min-w-0 truncate font-medium">{names?.[n] || <span className="opacity-60">{withNames ? "No name" : `Roll ${formatRoll(n, width)}`}</span>}</span>
            <RatePill rate={rates?.[n]} low={low} />
          </li>
        ))}
      </ol>
    );

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
      {rolls.map((n) => (
        <li
          key={n}
          aria-label={`Roll ${formatRoll(n, width)} — ${status}`}
          className={cn(
            "flex h-9 items-center justify-center rounded-lg border text-sm font-semibold tabular",
            variant === "absent" ? "border-absent-border bg-absent-bg text-absent-ink" : "border-border bg-card text-ink",
          )}
        >
          {formatRoll(n, width)}
        </li>
      ))}
    </ul>
  );
}
