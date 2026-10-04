"use client";

import * as React from "react";
import { Check, ChevronDown, FileSpreadsheet, ListPlus, Pencil, Plus, Sparkles, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { StudentImporter } from "@/components/students/student-importer";
import { store } from "@/lib/store/store";
import { formatRoll, formatShortDate, rollWidth } from "@/lib/format";
import { parsePositiveInt, rangeToRolls, validateRollRange, MAX_ROLLS_PER_MODULE, type FieldErrors } from "@/lib/validation";
import type { Student, StudentList, SubModule } from "@/lib/types";

type PendingImport = { students: Student[]; fileName: string };

export function RollNumberManager({ sub, studentLists }: { sub: SubModule; studentLists: StudentList[] }) {
  const [from, setFrom] = React.useState("1");
  const [to, setTo] = React.useState(sub.rollNumbers.length ? String(Math.max(...sub.rollNumbers)) : "");
  const [single, setSingle] = React.useState("");
  const [singleName, setSingleName] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors<"from" | "to" | "single">>({});
  const [pending, setPending] = React.useState<number[] | null>(null);
  const [pendingImport, setPendingImport] = React.useState<PendingImport | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [savedId, setSavedId] = React.useState("");
  const [editing, setEditing] = React.useState<number | null>(null);
  const [editName, setEditName] = React.useState("");

  const rolls = sub.rollNumbers;
  const width = rollWidth(rolls);
  const names = React.useMemo(() => new Map((sub.students ?? []).map((s) => [s.roll, s.name])), [sub.students]);
  const hasNames = (sub.students ?? []).some((s) => s.name);

  function save(next: number[], message: string) {
    const r = store.setRollNumbers(sub.id, next);
    if (r.ok) toast.success(message);
    else toast.error(r.error);
    return r.ok;
  }

  function importStudents(p: PendingImport) {
    const r = store.setStudents(sub.id, p.students, p.fileName);
    if (r.ok) {
      toast.success(`Imported ${p.students.length} students`, { description: p.fileName });
      setTo(String(Math.max(...r.data.rollNumbers)));
    } else toast.error(r.error);
    return r.ok;
  }

  function requestImport(p: PendingImport) {
    if (rolls.length) setPendingImport(p);
    else importStudents(p);
  }

  function generate(e: React.FormEvent) {
    e.preventDefault();
    const v = validateRollRange(from, to);
    setErrors(v.errors);
    if (!v.ok) return;
    const generated = rangeToRolls(v.from, v.to);
    if (rolls.length) setPending(generated);
    else save(generated, `Generated ${generated.length} roll numbers`);
  }

  function addSingle(e: React.FormEvent) {
    e.preventDefault();
    const n = parsePositiveInt(single);
    if (n === null) return setErrors({ single: "Enter a positive whole number (1, 2, 3…)." });
    if (rolls.includes(n)) return setErrors({ single: `Roll ${formatRoll(n, width)} already exists.` });
    if (rolls.length >= MAX_ROLLS_PER_MODULE) return setErrors({ single: `At most ${MAX_ROLLS_PER_MODULE} roll numbers.` });
    setErrors({});
    const r = store.upsertStudent(sub.id, n, singleName);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Added roll ${formatRoll(n, Math.max(width, String(n).length))}${singleName.trim() ? ` · ${singleName.trim()}` : ""}`);
    setSingle("");
    setSingleName("");
  }

  function remove(n: number) {
    const prevStudents = sub.students;
    const prevSource = sub.rosterSource;
    const next = rolls.filter((x) => x !== n);
    const r = store.setRollNumbers(sub.id, next);
    if (!r.ok) return toast.error(r.error);
    const label = names.get(n) ? `${formatRoll(n, width)} · ${names.get(n)}` : formatRoll(n, width);
    toast(`Removed roll ${label}`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (prevStudents?.length) store.setStudents(sub.id, prevStudents, prevSource?.fileName ?? "Student list");
          else store.setRollNumbers(sub.id, [...next, n]);
        },
      },
    });
  }

  function saveName(n: number) {
    const r = store.upsertStudent(sub.id, n, editName);
    if (!r.ok) return toast.error(r.error);
    setEditing(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-6">
        <Card className="p-5">
          <StudentImporter
            title="Upload student list"
            description="Upload the class list — a Google Sheet works best. Each student is numbered 1 to N with their name, or you can keep the roll numbers from the file."
            confirmLabel="Import"
            onImport={(r) => requestImport({ students: r.students, fileName: r.fileName })}
          />
        </Card>

        {studentLists.length > 0 && (
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Users className="size-4 text-primary" aria-hidden /> Use a saved student list
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Lists you uploaded in Profile → Student details.</p>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const list = studentLists.find((l) => l.id === savedId);
                if (!list) return toast.error("Choose a list first.");
                requestImport({ students: list.students, fileName: list.name });
              }}
            >
              <label htmlFor="saved-list" className="sr-only">Saved list</label>
              <select
                id="saved-list"
                value={savedId}
                onChange={(e) => setSavedId(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-ink shadow-sm"
              >
                <option value="">Choose a list…</option>
                {studentLists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.students.length})</option>
                ))}
              </select>
              <Button type="submit" variant="secondary"><ListPlus /> Use</Button>
            </form>
          </Card>
        )}

        <Card className="p-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-base font-semibold text-ink">No file? Add roll numbers manually</span>
                <span className="block text-sm text-ink-muted">Generate a range or add one student.</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="space-y-6 border-t border-border px-5 pb-5 pt-4">
              <form onSubmit={generate} noValidate className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From" htmlFor="roll-from" error={errors.from} required>
                    <Input id="roll-from" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} invalid={!!errors.from} className="tabular" />
                  </Field>
                  <Field label="To" htmlFor="roll-to" error={errors.to} required>
                    <Input id="roll-to" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} placeholder="37" invalid={!!errors.to} className="tabular" />
                  </Field>
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  <Sparkles /> Generate Roll Numbers
                </Button>
              </form>

              <form onSubmit={addSingle} noValidate className="space-y-3">
                <div className="grid grid-cols-[100px_1fr] gap-3">
                  <Field label="Roll no." htmlFor="roll-single" error={errors.single}>
                    <Input id="roll-single" inputMode="numeric" value={single} onChange={(e) => setSingle(e.target.value)} placeholder="38" invalid={!!errors.single} className="tabular" />
                  </Field>
                  <Field label="Name (optional)" htmlFor="roll-single-name">
                    <Input id="roll-single-name" value={singleName} onChange={(e) => setSingleName(e.target.value)} placeholder="Student name" maxLength={80} />
                  </Field>
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  <Plus /> Add student
                </Button>
              </form>
            </div>
          </details>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Students</h2>
            <p className="text-sm text-ink-muted tabular">
              {rolls.length} student{rolls.length === 1 ? "" : "s"}
              {sub.rosterSource && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs">
                  <FileSpreadsheet className="size-3" aria-hidden /> {sub.rosterSource.fileName} · {formatShortDate(sub.rosterSource.importedAt.slice(0, 10))}
                </span>
              )}
            </p>
          </div>
          {rolls.length > 0 && (
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirmClear(true)}>
              <Trash2 /> Clear all
            </Button>
          )}
        </div>

        {rolls.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-ink-muted">
            No students yet. Upload a student file to get started.
          </p>
        ) : hasNames ? (
          <ul className="mt-4 grid gap-1.5 sm:grid-cols-2" aria-label="Students">
            {rolls.map((n) => (
              <li key={n} className="flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-2 pr-1.5">
                <span className="grid h-8 min-w-10 place-items-center rounded-md bg-slate-100 px-1.5 text-sm font-semibold text-ink tabular">{formatRoll(n, width)}</span>
                {editing === n ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveName(n);
                    }}
                  >
                    <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} className="h-8" aria-label={`Name for roll ${formatRoll(n, width)}`} onKeyDown={(e) => e.key === "Escape" && setEditing(null)} />
                    <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save name"><Check /></Button>
                  </form>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{names.get(n) || <span className="text-ink-subtle">No name</span>}</span>
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit name for roll ${formatRoll(n, width)}`} onClick={() => { setEditing(n); setEditName(names.get(n) ?? ""); }}>
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="ghost" className="hover:text-danger" aria-label={`Remove roll ${formatRoll(n, width)}`} onClick={() => remove(n)}>
                      <X />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2" aria-label="Roll numbers">
            {rolls.map((n) => (
              <li key={n} className="group relative">
                <span className="flex h-11 items-center justify-center rounded-lg border border-border bg-card font-medium text-ink tabular">
                  {formatRoll(n, width)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(n)}
                  aria-label={`Remove roll ${formatRoll(n, width)}`}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-border bg-card text-ink-muted opacity-0 shadow-sm transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-ink-muted">
          Changing the student list never alters past attendance — each record keeps the list it was taken with.
        </p>
      </Card>

      <ConfirmationDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Update roll numbers?"
        description={`This sub module already has ${rolls.length} roll numbers. Replace them with ${pending?.length ?? 0} new ones, or add the new range to the existing list?`}
        confirmLabel="Replace"
        onConfirm={() => {
          if (pending && save(pending, `Replaced with ${pending.length} roll numbers`)) setPending(null);
        }}
      >
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            if (!pending) return;
            const merged = Array.from(new Set([...rolls, ...pending]));
            if (save(merged, `Now ${merged.length} roll numbers`)) setPending(null);
          }}
        >
          <Plus /> Add to existing instead
        </Button>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={pendingImport !== null}
        onOpenChange={(o) => !o && setPendingImport(null)}
        title="Replace the student list?"
        description={`This sub module already has ${rolls.length} students. Replace them with the ${pendingImport?.students.length ?? 0} students from “${pendingImport?.fileName ?? ""}”? Past attendance is not affected.`}
        confirmLabel="Replace list"
        onConfirm={() => {
          if (pendingImport && importStudents(pendingImport)) setPendingImport(null);
        }}
      />

      <ConfirmationDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all students?"
        description="The student list for this sub module will be emptied. Past attendance records are not affected."
        confirmLabel="Clear all"
        destructive
        onConfirm={() => {
          if (save([], "Student list cleared")) setConfirmClear(false);
        }}
      />
    </div>
  );
}
