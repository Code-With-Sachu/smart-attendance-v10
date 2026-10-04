"use client";

import * as React from "react";
import { Download, Eye, GraduationCap, ListPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { StudentImporter } from "@/components/students/student-importer";
import { store } from "@/lib/store/store";
import { byNumber } from "@/lib/store/selectors";
import { formatRoll, formatShortDate, rollWidth } from "@/lib/format";
import type { AppData, StudentList } from "@/lib/types";

/**
 * Profile → Student details. Upload and keep student files here; any saved list can be
 * applied to a sub module later. Lists keep every column of the file (in `details`)
 * so future features (parent contacts, register numbers…) can use them.
 */
export function StudentDetails({ data }: { data: AppData }) {
  const lists = data.studentLists;
  const [viewing, setViewing] = React.useState<StudentList | null>(null);
  const [applying, setApplying] = React.useState<StudentList | null>(null);
  const [deleting, setDeleting] = React.useState<StudentList | null>(null);

  return (
    <Card id="students" className="scroll-mt-24 p-5 sm:p-6">
      <StudentImporter
        title="Student details"
        description="Upload student detail files (Google Sheet, Excel, CSV, PDF, Word). They’re saved here with all their columns so you can reuse them in any class."
        confirmLabel="Save"
        onImport={(r) => {
          const res = store.saveStudentList({ name: r.fileName.replace(/\.[a-z0-9]+$/i, ""), fileName: r.fileName, columns: r.columns, students: r.students });
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(`Saved “${res.data.name}” · ${res.data.students.length} students`);
        }}
      />

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-ink">Saved lists</h3>
        {lists.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-ink-muted">No student files saved yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {lists.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <GraduationCap className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{l.name}</p>
                  <p className="text-xs text-ink-muted tabular">
                    {l.students.length} students · {formatShortDate(l.importedAt.slice(0, 10))}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={`View ${l.name}`} onClick={() => setViewing(l)}><Eye /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Download ${l.name} as CSV`} onClick={() => downloadCsv(l)}><Download /></Button>
                  <Button size="icon-sm" variant="ghost" className="hover:text-danger" aria-label={`Delete ${l.name}`} onClick={() => setDeleting(l)}><Trash2 /></Button>
                  <Button size="sm" variant="secondary" onClick={() => setApplying(l)}><ListPlus /> Use in class</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ViewListModal list={viewing} onClose={() => setViewing(null)} />
      <ApplyListModal list={applying} data={data} onClose={() => setApplying(null)} />
      <ConfirmationDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title="Delete this saved list?"
        description={`“${deleting?.name ?? ""}” will be removed from Profile. Classes that already use it keep their students.`}
        confirmLabel="Delete list"
        onConfirm={() => {
          if (!deleting) return;
          const r = store.deleteStudentList(deleting.id);
          if (r.ok) toast.success("List deleted");
          else toast.error(r.error);
          setDeleting(null);
        }}
      />
    </Card>
  );
}

function detailKeys(l: StudentList) {
  return Array.from(new Set(l.students.flatMap((s) => Object.keys(s.details ?? {}))));
}

function downloadCsv(l: StudentList) {
  const keys = detailKeys(l);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [["Roll No", "Name", ...keys].map(esc).join(",")];
  for (const s of l.students) lines.push([String(s.roll), s.name, ...keys.map((k) => s.details?.[k] ?? "")].map(esc).join(","));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${l.name.replace(/[^\w\- ]+/g, "").trim() || "students"}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ViewListModal({ list, onClose }: { list: StudentList | null; onClose: () => void }) {
  if (!list) return <Modal open={false} onOpenChange={onClose} title="" />;
  const keys = detailKeys(list).slice(0, 6);
  const width = rollWidth(list.students.map((s) => s.roll));
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={list.name} description={`${list.students.length} students · from ${list.fileName}`} className="sm:max-w-3xl">
      <div className="max-h-[60dvh] overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Roll</th>
              <th scope="col" className="px-3 py-2">Name</th>
              {keys.map((k) => (
                <th key={k} scope="col" className="whitespace-nowrap px-3 py-2">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.students.map((s) => (
              <tr key={s.roll}>
                <td className="px-3 py-1.5 font-semibold text-ink tabular">{formatRoll(s.roll, width)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-ink">{s.name || "—"}</td>
                {keys.map((k) => (
                  <td key={k} className="whitespace-nowrap px-3 py-1.5 text-ink-muted">{s.details?.[k] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function ApplyListModal({ list, data, onClose }: { list: StudentList | null; data: AppData; onClose: () => void }) {
  const [subId, setSubId] = React.useState("");
  React.useEffect(() => setSubId(""), [list]);
  const groups = [...data.mainModules].sort(byNumber).map((m) => ({ main: m, subs: data.subModules.filter((s) => s.mainModuleId === m.id).sort(byNumber) })).filter((g) => g.subs.length);
  const target = data.subModules.find((s) => s.id === subId);

  return (
    <Modal
      open={list !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Use this list in a class"
      description={list ? `“${list.name}” · ${list.students.length} students` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!target}
            onClick={() => {
              if (!list || !target) return;
              const r = store.setStudents(target.id, list.students, list.name);
              if (!r.ok) return toast.error(r.error);
              toast.success(`${target.name} now has ${list.students.length} students`);
              onClose();
            }}
          >
            Apply list
          </Button>
        </>
      }
    >
      {groups.length === 0 ? (
        <p className="text-sm text-ink-muted">Create a main module and a sub module first.</p>
      ) : (
        <div className="space-y-2">
          <label htmlFor="apply-sub" className="block text-sm font-medium text-ink">Sub module</label>
          <select id="apply-sub" value={subId} onChange={(e) => setSubId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink shadow-sm">
            <option value="">Choose a sub module…</option>
            {groups.map((g) => (
              <optgroup key={g.main.id} label={g.main.name}>
                {g.subs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.rollNumbers.length} students)</option>
                ))}
              </optgroup>
            ))}
          </select>
          {target && target.rollNumbers.length > 0 && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-ink">
              {target.name} already has {target.rollNumbers.length} students — they’ll be replaced. Past attendance isn’t affected.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
