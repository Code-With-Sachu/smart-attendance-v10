import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatLongDate, formatTime, percent } from "@/lib/format";
import { recordRate } from "@/lib/store/selectors";
import type { AttendanceRecord } from "@/lib/types";

export function RecordRow({ r, showModule = true }: { r: AttendanceRecord; showModule?: boolean }) {
  return (
    <Link href={`/history/${r.id}`} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {formatLongDate(r.date)}
          <span className="ml-2 font-normal text-ink-muted">{formatTime(r.takenAt)}{r.session > 1 ? ` · Session ${r.session}` : ""}</span>
        </p>
        {showModule && (
          <p className="mt-0.5 truncate text-sm text-ink-muted">
            {r.mainModuleName} · <span className="text-ink">{r.subModuleName}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm tabular sm:gap-5">
        <div className="text-right">
          <p className="font-medium text-ink">Present: {r.present.length}</p>
          <p className="text-absent-strong">Absent: {r.absent.length}</p>
        </div>
        <span className="hidden w-14 rounded-md bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-ink sm:block">{percent(recordRate(r), 1, 0)}</span>
        <ChevronRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
        <span className="sr-only">View details</span>
      </div>
    </Link>
  );
}
