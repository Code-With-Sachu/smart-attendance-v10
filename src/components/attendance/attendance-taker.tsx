"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, CheckCheck, FlipHorizontal2, Keyboard, RotateCcw, Undo2, UserX, History as HistoryIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { RollNumberGrid } from "./roll-number-grid";
import { AttendanceSummary } from "./attendance-summary";
import { draftKey, useAttendanceDraft } from "@/lib/use-attendance-draft";
import { formatLongDate, formatRoll, formatTime, rollWidth, todayISO } from "@/lib/format";
import { parsePositiveInt } from "@/lib/validation";
import { store } from "@/lib/store/store";
import type { AttendanceDraft, AttendanceRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface TakerContext {
  subModuleId: string;
  mainName: string;
  subName: string;
  color: string;
  rolls: number[];
  /** roll → student name (empty when the class has no uploaded list). */
  names: Record<number, string>;
  editing?: AttendanceRecord;
}

export function AttendanceTaker({ ctx }: { ctx: TakerContext }) {
  const router = useRouter();
  const key = draftKey(ctx.subModuleId, ctx.editing?.id);

  const makeInitial = React.useCallback((): AttendanceDraft => {
    const now = new Date().toISOString();
    if (ctx.editing) {
      return { subModuleId: ctx.subModuleId, absent: [...ctx.editing.absent], date: ctx.editing.date, session: ctx.editing.session, startedAt: ctx.editing.takenAt, updatedAt: now, editingRecordId: ctx.editing.id };
    }
    const date = todayISO();
    return { subModuleId: ctx.subModuleId, absent: [], date, session: store.nextFreeSession(ctx.subModuleId, date), startedAt: now, updatedAt: now };
  }, [ctx.subModuleId, ctx.editing]);

  const { draft, phase, found, update, restore, discard, flush } = useAttendanceDraft(key, makeInitial);
  const [initialAbsent] = React.useState(() => makeInitial().absent);
  const undoStack = React.useRef<number[][]>([]);
  const [canUndo, setCanUndo] = React.useState(false);
  const [confirmAllAbsent, setConfirmAllAbsent] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [quick, setQuick] = React.useState("");
  const [quickError, setQuickError] = React.useState<string>();

  const rolls = ctx.rolls;
  const rollSet = React.useMemo(() => new Set(rolls), [rolls]);
  const absent = React.useMemo(() => new Set((draft?.absent ?? []).filter((n) => rollSet.has(n))), [draft?.absent, rollSet]);
  const width = rollWidth(rolls);

  const setAbsent = React.useCallback(
    (next: number[]) => {
      if (!draft) return;
      undoStack.current.push(draft.absent);
      if (undoStack.current.length > 50) undoStack.current.shift();
      setCanUndo(true);
      update({ absent: [...next].sort((a, b) => a - b) });
    },
    [draft, update],
  );

  const toggle = React.useCallback(
    (roll: number) => {
      if (!draft) return;
      const cur = new Set(draft.absent);
      if (cur.has(roll)) cur.delete(roll);
      else cur.add(roll);
      setAbsent([...cur]);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    },
    [draft, setAbsent],
  );

  function undo() {
    const prev = undoStack.current.pop();
    if (prev) update({ absent: prev });
    setCanUndo(undoStack.current.length > 0);
  }

  function applyQuick(e: React.FormEvent) {
    e.preventDefault();
    const tokens = quick.split(/[\s,]+/).filter(Boolean);
    if (!tokens.length) return;
    const add: number[] = [];
    for (const t of tokens) {
      const range = t.match(/^(\d+)-(\d+)$/);
      if (range) {
        const a = parsePositiveInt(range[1]!);
        const b = parsePositiveInt(range[2]!);
        if (a === null || b === null || b < a) return setQuickError(`“${t}” isn’t a valid range.`);
        for (let i = a; i <= b; i++) add.push(i);
        continue;
      }
      const n = parsePositiveInt(t);
      if (n === null) return setQuickError(`“${t}” isn’t a positive whole number.`);
      add.push(n);
    }
    const unknown = add.filter((n) => !rollSet.has(n));
    if (unknown.length) return setQuickError(`Not in this class: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}`);
    setQuickError(undefined);
    setAbsent([...new Set([...(draft?.absent ?? []), ...add])]);
    setQuick("");
    toast.success(`Marked ${add.length} absent`);
  }

  function apply() {
    flush();
    const q = ctx.editing ? `?edit=${ctx.editing.id}` : "";
    router.push(`/attendance/${ctx.subModuleId}/review${q}`);
  }

  if (!draft) return <GridSkeleton />;

  const total = rolls.length;
  const absentCount = absent.size;
  const presentCount = total - absentCount;
  const dirtyFromStart = draft.absent.join() !== initialAbsent.join();
  const absentList = [...absent].sort((a, b) => a - b);

  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:-mx-8 lg:-mt-8">
      {/* Sticky header */}
      <div className="sticky top-16 z-20 border-b border-border bg-card/90 px-4 py-2.5 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: ctx.color }} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {ctx.mainName} <span className="text-ink-subtle">/</span> {ctx.subName}
            </p>
            <p className="truncate text-xs text-ink-muted">{ctx.editing ? "Editing saved record" : "New attendance"}</p>
          </div>
          <div className="flex items-center gap-2 text-sm tabular" aria-live="polite">
            <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-ink">
              <span className="hidden sm:inline">Present: </span>
              <span className="sm:hidden">P </span>
              {presentCount}
            </span>
            <span className="rounded-md bg-absent-bg px-2 py-1 font-medium text-absent-ink">
              <span className="hidden sm:inline">Absent: </span>
              <span className="sm:hidden">A </span>
              {absentCount}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-40 pt-5 sm:px-6 lg:px-8">
        {/* Session heading */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink-muted">{ctx.mainName}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{ctx.subName}</h1>
            <button type="button" onClick={() => setDetailsOpen(true)} disabled={!!ctx.editing} className="mt-1.5 inline-flex items-center gap-2 rounded-md text-sm text-ink-muted hover:text-ink disabled:hover:text-ink-muted">
              <CalendarDays className="size-4" aria-hidden />
              <span>
                {formatLongDate(draft.date)} · {formatTime(draft.startedAt)}
                {draft.session > 1 || ctx.editing ? ` · Session ${draft.session}` : ""}
              </span>
              {!ctx.editing && <Pencil className="size-3.5" aria-label="Change date or session" />}
            </button>
          </div>
          <p className="text-sm text-ink-muted">
            Everyone starts <strong className="font-semibold text-ink">present</strong>. Tap a roll number to mark <strong className="font-semibold text-absent-strong">absent</strong>.
          </p>
        </div>

        <AttendanceSummary total={total} absent={absentCount} className="mb-4" />

        {/* Controls */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAbsent([])} disabled={absentCount === 0}>
            <CheckCheck /> Mark All Present
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAbsent(initialAbsent)} disabled={!dirtyFromStart}>
            <RotateCcw /> Clear Selection
          </Button>
          <Button variant="secondary" size="sm" onClick={undo} disabled={!canUndo}>
            <Undo2 /> Undo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAbsent(rolls.filter((n) => !absent.has(n)))}>
            <FlipHorizontal2 /> Invert
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmAllAbsent(true)} disabled={absentCount === total} className="text-absent-strong hover:bg-absent-bg hover:text-absent-ink">
            <UserX /> Mark All Absent
          </Button>
        </div>

        <RollNumberGrid rolls={rolls} names={ctx.names} absent={absent} onToggle={toggle} />

        {/* Quick entry */}
        <Card className="mt-6 p-4">
          <form onSubmit={applyQuick} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Field label="Quick entry" htmlFor="quick-entry" error={quickError} hint="Type absentees: 3, 8, 17 or a range like 20-24, then press Enter." className="flex-1">
              <div className="relative">
                <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <Input id="quick-entry" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="3, 8, 17" className="pl-9 tabular" inputMode="text" invalid={!!quickError} autoComplete="off" />
              </div>
            </Field>
            <Button type="submit" variant="secondary" className="sm:mt-[26px]">Mark absent</Button>
          </form>
        </Card>
      </div>

      {/* Sticky footer */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pt-3 backdrop-blur lg:left-auto lg:w-[calc(100%-var(--sidebar-w,16rem))]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 sm:px-2 lg:px-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-ink-muted">Absent ({absentCount})</p>
            <p className={cn("truncate text-sm font-semibold tabular", absentCount ? "text-absent-ink" : "text-ink-subtle")}>
              {absentCount ? absentList.map((n) => formatRoll(n, width)).join(", ") : "No one marked absent"}
            </p>
          </div>
          <Button size="lg" onClick={apply} className="shrink-0">
            Apply Section <ArrowRight />
          </Button>
        </div>
      </div>

      <ConfirmationDialog
        open={confirmAllAbsent}
        onOpenChange={setConfirmAllAbsent}
        title="Mark all students absent?"
        description={`All ${total} students will be marked absent. You can undo this.`}
        confirmLabel="Mark all absent"
        destructive
        onConfirm={() => {
          setAbsent(rolls);
          setConfirmAllAbsent(false);
        }}
      />

      <ConfirmationDialog
        open={phase === "prompt"}
        onOpenChange={() => {
          /* force an explicit choice */
        }}
        onCancel={discard}
        title="Unsaved Attendance Found"
        description={
          found ? (
            <>
              You have an unsubmitted selection from {formatTime(found.updatedAt)}
              {found.date !== todayISO() ? ` on ${formatLongDate(found.date)}` : ""} with <strong className="text-absent-ink">{found.absent.length} absent</strong>. Restore it?
            </>
          ) : null
        }
        cancelLabel="Discard"
        confirmLabel="Restore"
        onConfirm={restore}
      >
        <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-muted">
          <HistoryIcon className="size-3.5" aria-hidden /> Selections are saved on this device while you work.
        </p>
      </ConfirmationDialog>

      <SessionDetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        date={draft.date}
        session={draft.session}
        subModuleId={ctx.subModuleId}
        onSave={(date, session) => {
          update({ date, session });
          setDetailsOpen(false);
        }}
      />
    </div>
  );
}

function SessionDetailsModal({
  open,
  onOpenChange,
  date,
  session,
  subModuleId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  session: number;
  subModuleId: string;
  onSave: (date: string, session: number) => void;
}) {
  const [d, setD] = React.useState(date);
  const [s, setS] = React.useState(String(session));
  const [err, setErr] = React.useState<{ date?: string; session?: string }>({});
  React.useEffect(() => {
    if (open) {
      setD(date);
      setS(String(session));
      setErr({});
    }
  }, [open, date, session]);

  const existing = /^\d{4}-\d{2}-\d{2}$/.test(d) && parsePositiveInt(s, 20) ? store.findDuplicate(subModuleId, d, Number(s)) : undefined;

  function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parsePositiveInt(s, 20);
    const errors: typeof err = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.date = "Choose a valid date.";
    else if (d > todayISO()) errors.date = "Attendance can’t be recorded for a future date.";
    if (n === null) errors.session = "Enter a session number from 1 to 20.";
    setErr(errors);
    if (Object.keys(errors).length) return;
    onSave(d, n!);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Session details"
      description="Use a session number when the same subject meets more than once a day."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="session-form">Save</Button>
        </>
      }
    >
      <form id="session-form" onSubmit={save} noValidate className="space-y-4">
        <Field label="Date" htmlFor="session-date" error={err.date} required>
          <Input id="session-date" type="date" value={d} max={todayISO()} onChange={(e) => setD(e.target.value)} invalid={!!err.date} />
        </Field>
        <Field label="Session / period" htmlFor="session-number" error={err.session} required>
          <Input id="session-number" inputMode="numeric" value={s} onChange={(e) => setS(e.target.value.replace(/[^\d]/g, ""))} className="max-w-[120px] tabular" invalid={!!err.session} />
        </Field>
        {existing && (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            Attendance for this date and session already exists. You’ll be asked what to do when you submit.
          </p>
        )}
      </form>
    </Modal>
  );
}

function GridSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading attendance">
      <div className="skeleton mb-2 h-4 w-24" />
      <div className="skeleton mb-6 h-8 w-64" />
      <div className="skeleton mb-4 h-16 w-full rounded-xl" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(76px,1fr))]">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
