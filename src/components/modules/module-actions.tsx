"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModuleFormModal, type ModuleFormValues } from "./module-form-modal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { store } from "@/lib/store/store";
import { useAppData } from "@/lib/store/hooks";
import { nextPresetColor } from "@/lib/colors";
import { pluralize } from "@/lib/utils";
import type { MainModule, SubModule } from "@/lib/types";

type FormState =
  | { kind: "create-main" }
  | { kind: "edit-main"; mod: MainModule }
  | { kind: "create-sub"; mainId: string }
  | { kind: "edit-sub"; sub: SubModule }
  | null;

type DeleteState = { kind: "main"; mod: MainModule } | { kind: "sub"; sub: SubModule } | null;

interface ModuleActions {
  createMain: () => void;
  editMain: (m: MainModule) => void;
  duplicateMain: (m: MainModule) => void;
  deleteMain: (m: MainModule) => void;
  createSub: (mainId: string) => void;
  editSub: (s: SubModule) => void;
  deleteSub: (s: SubModule) => void;
  takeAttendanceForMain: (m: MainModule) => void;
}

const Ctx = React.createContext<ModuleActions | null>(null);

export function useModuleActions() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useModuleActions must be used inside ModuleActionsProvider");
  return v;
}

export function ModuleActionsProvider({ children }: { children: React.ReactNode }) {
  const data = useAppData();
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(null);
  const [lastForm, setLastForm] = React.useState<FormState>(null);
  const [del, setDel] = React.useState<DeleteState>(null);
  const [lastDel, setLastDel] = React.useState<DeleteState>(null);

  const openForm = (f: FormState) => {
    setForm(f);
    setLastForm(f);
  };
  const openDelete = (d: DeleteState) => {
    setDel(d);
    setLastDel(d);
  };

  const actions = React.useMemo<ModuleActions>(
    () => ({
      createMain: () => openForm({ kind: "create-main" }),
      editMain: (mod) => openForm({ kind: "edit-main", mod }),
      duplicateMain: (mod) => {
        const r = store.duplicateMainModule(mod.id);
        if (r.ok) toast.success(`Duplicated as “${r.data.name}”`);
        else toast.error(r.error);
      },
      deleteMain: (mod) => openDelete({ kind: "main", mod }),
      createSub: (mainId) => openForm({ kind: "create-sub", mainId }),
      editSub: (sub) => openForm({ kind: "edit-sub", sub }),
      deleteSub: (sub) => openDelete({ kind: "sub", sub }),
      takeAttendanceForMain: (mod) => {
        const subs = store.getSnapshot()?.subModules.filter((s) => s.mainModuleId === mod.id) ?? [];
        if (subs.length === 1) router.push(`/attendance/${subs[0]!.id}`);
        else router.push(`/attendance?main=${mod.id}`);
      },
    }),
    [router],
  );

  // Keep modal content stable during its close animation.
  const f = form ?? lastForm;
  const d = del ?? lastDel;

  const nextNumber = (list: { number: number }[]) => String(Math.max(0, ...list.map((x) => x.number)) + 1);

  let formProps: {
    title: string;
    description?: string;
    submitLabel: string;
    nameLabel: string;
    namePlaceholder: string;
    initial: ModuleFormValues;
    onSubmit: (v: ModuleFormValues) => ReturnType<typeof store.createMainModule> | ReturnType<typeof store.createSubModule>;
  } | null = null;

  if (f && data) {
    if (f.kind === "create-main") {
      formProps = {
        title: "Create Main Module",
        description: "A main module is a class or group, e.g. CSE S3.",
        submitLabel: "Create Module",
        nameLabel: "Module name",
        namePlaceholder: "e.g. CSE S3",
        initial: { name: "", number: nextNumber(data.mainModules), color: nextPresetColor(data.mainModules.length) },
        onSubmit: (v) => {
          const r = store.createMainModule(v);
          if (r.ok) {
            toast.success(`“${r.data.name}” created`);
            setForm(null);
          }
          return r;
        },
      };
    } else if (f.kind === "edit-main") {
      formProps = {
        title: "Edit Main Module",
        submitLabel: "Save Changes",
        nameLabel: "Module name",
        namePlaceholder: "e.g. CSE S3",
        initial: { name: f.mod.name, number: String(f.mod.number), color: f.mod.color },
        onSubmit: (v) => {
          const r = store.updateMainModule(f.mod.id, v);
          if (r.ok) {
            toast.success("Module updated");
            setForm(null);
          }
          return r;
        },
      };
    } else if (f.kind === "create-sub") {
      const parent = data.mainModules.find((m) => m.id === f.mainId);
      const siblings = data.subModules.filter((s) => s.mainModuleId === f.mainId);
      formProps = {
        title: "Create Sub Module",
        description: parent ? `Inside ${parent.name}. A sub module is usually a subject.` : undefined,
        submitLabel: "Create Sub Module",
        nameLabel: "Sub module name",
        namePlaceholder: "e.g. Data Structures",
        initial: { name: "", number: nextNumber(siblings), color: nextPresetColor(siblings.length + 1) },
        onSubmit: (v) => {
          const r = store.createSubModule(f.mainId, v);
          if (r.ok) {
            setForm(null);
            toast.success(`“${r.data.name}” created`, {
              description: "Next: add roll numbers.",
              action: { label: "Add roll numbers", onClick: () => router.push(`/sub-modules/${r.data.id}/roll-numbers`) },
            });
          }
          return r;
        },
      };
    } else if (f.kind === "edit-sub") {
      formProps = {
        title: "Edit Sub Module",
        submitLabel: "Save Changes",
        nameLabel: "Sub module name",
        namePlaceholder: "e.g. Data Structures",
        initial: { name: f.sub.name, number: String(f.sub.number), color: f.sub.color },
        onSubmit: (v) => {
          const r = store.updateSubModule(f.sub.id, v);
          if (r.ok) {
            toast.success("Sub module updated");
            setForm(null);
          }
          return r;
        },
      };
    }
  }

  let deleteInfo: { title: string; body: React.ReactNode } | null = null;
  if (d && data) {
    if (d.kind === "main") {
      const subs = data.subModules.filter((s) => s.mainModuleId === d.mod.id).length;
      const recs = data.records.filter((r) => r.mainModuleId === d.mod.id).length;
      deleteInfo = {
        title: `Delete “${d.mod.name}”?`,
        body: (
          <>
            <p>This will permanently remove the module and its {pluralize(subs, "sub module")}, including their roll numbers.</p>
            {recs > 0 && (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-ink">
                {pluralize(recs, "attendance record")} will stay in Previous Attendance.
              </p>
            )}
          </>
        ),
      };
    } else {
      const recs = data.records.filter((r) => r.subModuleId === d.sub.id).length;
      deleteInfo = {
        title: `Delete “${d.sub.name}”?`,
        body: (
          <>
            <p>This will permanently remove the sub module and its roll numbers.</p>
            {recs > 0 && (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-ink">
                {pluralize(recs, "attendance record")} will stay in Previous Attendance.
              </p>
            )}
          </>
        ),
      };
    }
  }

  function confirmDelete() {
    if (!del) return;
    const r = del.kind === "main" ? store.deleteMainModule(del.mod.id) : store.deleteSubModule(del.sub.id);
    if (r.ok) {
      toast.success(`“${del.kind === "main" ? del.mod.name : del.sub.name}” deleted`);
      setDel(null);
      const p = window.location.pathname;
      if (del.kind === "main" && p.startsWith(`/modules/${del.mod.id}`)) router.replace("/modules");
      if (del.kind === "sub" && (p.startsWith(`/sub-modules/${del.sub.id}`) || p.startsWith(`/attendance/${del.sub.id}`)))
        router.replace(`/modules/${del.sub.mainModuleId}`);
    } else toast.error(r.error);
  }

  return (
    <Ctx.Provider value={actions}>
      {children}
      {formProps && (
        <ModuleFormModal
          open={form !== null}
          onOpenChange={(o) => !o && setForm(null)}
          {...formProps}
        />
      )}
      {deleteInfo && (
        <ConfirmationDialog
          open={del !== null}
          onOpenChange={(o) => !o && setDel(null)}
          title={deleteInfo.title}
          description={deleteInfo.body}
          confirmLabel="Delete"
          destructive
          onConfirm={confirmDelete}
        />
      )}
    </Ctx.Provider>
  );
}
