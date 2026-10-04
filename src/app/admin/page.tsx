"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity, Bot, Database, Download, FileSpreadsheet, FileText, Files, GraduationCap, HardDrive, History, LayoutDashboard,
  MessageCircle, Pencil, Save, Settings, Trash2, TriangleAlert, Upload, Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAppData } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";
import { filesStore, useFiles } from "@/lib/files/store";
import { formatBytes } from "@/lib/files/extract";
import { KIND_LABEL } from "@/lib/files/types";
import { chat, useChat } from "@/lib/ai/chat";
import { fileLocation } from "@/lib/ai/context";
import { backupJson, exportWorkbook, filesFromBackup, storageUsage } from "@/lib/export";
import { byNewest, mainOptionsWithHistory, recordRate, studentReportsForMain } from "@/lib/store/selectors";
import { buildAttendanceMessage } from "@/lib/whatsapp";
import { downloadText, messageOptionsFor } from "@/lib/report";
import { formatLongDate, formatShortDate, formatTime, percent, todayISO } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FileEditor } from "@/components/files/file-editor";
import { downloadStoredFile } from "@/components/files/file-manager";
import { useWhatsAppCloud } from "@/components/attendance/whatsapp-share";
import type { AppData } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "data", label: "Data & backup", icon: Database },
  { id: "files", label: "All files", icon: Files },
  { id: "records", label: "Records", icon: History },
  { id: "activity", label: "Activity log", icon: Activity },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const data = useAppData();
  const [tab, setTab] = React.useState<Tab>("overview");

  React.useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.id === h)) setTab(h);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  if (!data) return null;
  return (
    <>
      <PageHeader title="Admin" description="Manage all data, settings, files and integrations. Open to everyone — no login." />
      <div role="tablist" aria-label="Admin sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => go(t.id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              tab === t.id ? "bg-primary text-white shadow-sm" : "border border-border bg-card text-ink-muted hover:text-ink",
            )}
          >
            <t.icon className="size-4" aria-hidden /> {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview data={data} go={go} />}
      {tab === "settings" && <SettingsTab data={data} />}
      {tab === "data" && <DataTab data={data} />}
      {tab === "files" && <FilesTab data={data} />}
      {tab === "records" && <RecordsTab data={data} />}
      {tab === "activity" && <ActivityTab data={data} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Overview({ data, go }: { data: AppData; go: (t: Tab) => void }) {
  const files = useFiles() ?? [];
  const ai = useChat();
  const cloud = useWhatsAppCloud();
  const [usage, setUsage] = React.useState(0);
  React.useEffect(() => setUsage(storageUsage()), [data]);
  const students = new Set(data.subModules.flatMap((s) => s.rollNumbers.map((n) => `${s.mainModuleId}:${n}`))).size;
  const avg = data.records.length ? data.records.reduce((s, r) => s + recordRate(r), 0) / data.records.length : null;
  const lowCount = mainOptionsWithHistory(data).flatMap((m) => studentReportsForMain(data, m.id)).filter((r) => r.rate !== null && r.rate * 100 < data.settings.lowThreshold).length;

  const tiles = [
    { label: "Main modules", value: data.mainModules.length, icon: GraduationCap, href: "/modules" },
    { label: "Sub modules", value: data.subModules.length, icon: GraduationCap, href: "/sub-modules" },
    { label: "Students", value: students, icon: Users, href: "/history?view=students" },
    { label: "Attendance sessions", value: data.records.length, icon: History, href: "/history" },
    { label: "Average attendance", value: avg === null ? "—" : percent(avg, 1), icon: Activity },
    { label: `Below ${data.settings.lowThreshold}%`, value: lowCount, icon: TriangleAlert, href: "/history?view=students" },
    { label: "Uploaded files", value: `${files.length} · ${formatBytes(filesStore.totalBytes())}`, icon: Files, onClick: () => go("files") },
    { label: "Browser storage used", value: formatBytes(usage), icon: HardDrive, onClick: () => go("data") },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <t.icon className="size-4 text-primary" aria-hidden />
              <p className="mt-2 text-xs font-medium text-ink-muted">{t.label}</p>
              <p className="mt-0.5 text-xl font-semibold text-ink tabular">{t.value}</p>
            </>
          );
          const cls = "rounded-xl border border-border bg-card p-4 text-left shadow-card transition-shadow hover:shadow-pop";
          return t.href ? <Link key={t.label} href={t.href} className={cls}>{body}</Link> : t.onClick ? <button key={t.label} type="button" onClick={t.onClick} className={cls}>{body}</button> : <div key={t.label} className={cls}>{body}</div>;
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Bot className="size-4 text-primary" /> AI assistant</h2>
          <StatusRow ok={ai.provider === "gemini"} label={ai.provider === "gemini" ? `Google Gemini connected (${ai.model})` : "Offline helper (no AI key on the server)"} />
          <p className="mt-2 text-xs text-ink-muted">Set <code className="rounded bg-slate-100 px-1">GEMINI_API_KEY</code> (and optionally <code className="rounded bg-slate-100 px-1">GEMINI_MODEL</code>) in your Vercel project → Settings → Environment Variables, then redeploy.</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => chat.checkStatus(true)}>Recheck</Button>
        </Card>
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><MessageCircle className="size-4 text-[#1FAF38]" /> WhatsApp</h2>
          <StatusRow ok={cloud} label={cloud ? "Cloud API connected — reports go to all numbers at once" : "wa.me links — one tap opens every chat"} />
          <p className="mt-2 text-xs text-ink-muted">
            {data.settings.whatsappContacts.length} number{data.settings.whatsappContacts.length === 1 ? "" : "s"} saved · <Link href="/profile#whatsapp" className="font-medium text-primary-ink hover:underline">manage</Link>. For automatic sending set <code className="rounded bg-slate-100 px-1">WHATSAPP_TOKEN</code> and <code className="rounded bg-slate-100 px-1">WHATSAPP_PHONE_NUMBER_ID</code>.
          </p>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className="mt-3 flex items-center gap-2 text-sm text-ink">
      <span className={cn("size-2 rounded-full", ok ? "bg-success" : "bg-amber-500")} aria-hidden /> {label}
    </p>
  );
}

/* ------------------------------------------------------------------ */

function SettingsTab({ data }: { data: AppData }) {
  const s = data.settings;
  const [v, setV] = React.useState({ institutionName: s.institutionName, lowThreshold: String(s.lowThreshold), assistantName: s.assistantName });
  const latest = [...data.records].sort(byNewest)[0];
  const preview = latest ? buildAttendanceMessage(latest, messageOptionsFor(data, latest)) : null;

  function save(e: React.FormEvent) {
    e.preventDefault();
    const r = store.updateAdminSettings({ institutionName: v.institutionName, lowThreshold: Number(v.lowThreshold), assistantName: v.assistantName });
    if (r.ok) toast.success("Settings saved");
    else toast.error(r.error);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card className="p-5 sm:p-6">
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Institution / department name" htmlFor="st-inst" hint="Shown at the top of WhatsApp reports.">
            <Input id="st-inst" value={v.institutionName} onChange={(e) => setV({ ...v, institutionName: e.target.value })} maxLength={80} placeholder="e.g. Dept. of CSE, XYZ College of Engineering" />
          </Field>
          <Field label="Low attendance threshold (%)" htmlFor="st-th" hint="Students below this are highlighted in red everywhere.">
            <Input id="st-th" inputMode="numeric" value={v.lowThreshold} onChange={(e) => setV({ ...v, lowThreshold: e.target.value.replace(/\D/g, "") })} className="max-w-[120px] tabular" />
          </Field>
          <Field label="Assistant name" htmlFor="st-an">
            <Input id="st-an" value={v.assistantName} onChange={(e) => setV({ ...v, assistantName: e.target.value })} maxLength={40} />
          </Field>
          <Button type="submit"><Save /> Save settings</Button>
        </form>

        <div className="mt-6 space-y-3 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-ink">WhatsApp message</h3>
          <div role="radiogroup" className="inline-flex rounded-lg border border-border bg-slate-50 p-1 text-sm">
            {(["professional", "plain"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={s.messageStyle === m} type="button" onClick={() => store.updateAdminSettings({ messageStyle: m })} className={cn("rounded-md px-3 py-1 font-medium capitalize", s.messageStyle === m ? "bg-card text-ink shadow-sm" : "text-ink-muted")}>
                {m === "professional" ? "Professional (with icons)" : "Plain text"}
              </button>
            ))}
          </div>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={s.includePercentInMessage} onChange={(e) => store.updateAdminSettings({ includePercentInMessage: e.target.checked })} />
            <span className="text-sm text-ink">Show each student’s overall % next to their name</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={s.assistantEnabled} onChange={(e) => store.updateAdminSettings({ assistantEnabled: e.target.checked })} />
            <span className="text-sm text-ink">Show the floating AI assistant on every page</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={s.allowDuplicateSessions} onChange={(e) => store.updateSettings({ allowDuplicateSessions: e.target.checked })} />
            <span className="text-sm text-ink">Allow more than one record for the same subject, date and period</span>
          </label>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-ink">Message preview</h3>
        {preview ? (
          <pre className="mt-3 max-h-[540px] overflow-auto whitespace-pre-wrap rounded-xl bg-[#e7fbe0] p-4 font-sans text-[13px] leading-relaxed text-[#111b21] dark:bg-[#0b3d2e] dark:text-[#e9edef]">{preview}</pre>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">Submit an attendance to see how the report will look.</p>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DataTab({ data }: { data: AppData }) {
  const files = useFiles();
  const [withFiles, setWithFiles] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [restore, setRestore] = React.useState<unknown>(null);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const restoreRef = React.useRef<HTMLInputElement>(null);

  async function backup() {
    setBusy("backup");
    try {
      const json = await backupJson(data, withFiles ? files ?? [] : null);
      downloadText(json, `smart-attendance-backup-${todayISO()}.json`, "application/json");
      store.log("Backup downloaded", withFiles ? "with files" : "data only");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Download className="size-4 text-primary" /> Backup</h2>
        <p className="mt-1 text-sm text-ink-muted">Everything is stored in this browser only. Download a backup regularly, and restore it on another device.</p>
        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-primary" checked={withFiles} onChange={(e) => setWithFiles(e.target.checked)} /> Include uploaded files ({formatBytes(filesStore.totalBytes())})
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={backup} disabled={busy !== null}><Download /> {busy === "backup" ? "Preparing…" : "Download backup"}</Button>
          <Button variant="secondary" onClick={() => restoreRef.current?.click()}><Upload /> Restore backup</Button>
          <input
            ref={restoreRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                setRestore(JSON.parse(await f.text()));
              } catch {
                toast.error("That file isn’t a valid backup.");
              }
            }}
          />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><FileSpreadsheet className="size-4 text-success" /> Export to Excel</h2>
        <p className="mt-1 text-sm text-ink-muted">One workbook with every session, every absence, and a sheet per class with each student’s overall and subject-wise percentage.</p>
        <Button className="mt-4" variant="secondary" disabled={busy !== null} onClick={async () => { setBusy("xlsx"); try { await exportWorkbook(data); } finally { setBusy(null); } }}>
          <FileSpreadsheet /> {busy === "xlsx" ? "Building…" : "Download Excel (.xlsx)"}
        </Button>
      </Card>

      <Card className="border-danger/30 p-5 sm:p-6 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-danger"><TriangleAlert className="size-4" /> Danger zone</h2>
        <p className="mt-1 text-sm text-ink-muted">Delete all modules, students, attendance, settings and files from this browser.</p>
        <Button variant="danger" className="mt-4" onClick={() => { setTyped(""); setClearOpen(true); }}><Trash2 /> Clear all data</Button>
      </Card>

      <ConfirmationDialog
        open={restore !== null}
        onOpenChange={(o) => !o && setRestore(null)}
        title="Restore this backup?"
        description="Your current modules, attendance and settings will be replaced by the backup. Files in the backup are added."
        confirmLabel="Restore"
        destructive
        onConfirm={async () => {
          const r = store.restoreBackup(restore);
          if (!r.ok) return toast.error(r.error);
          const f = filesFromBackup(restore);
          if (f.length) await filesStore.importMany(f);
          toast.success(`Backup restored · ${r.data.records.length} records${f.length ? ` · ${f.length} files` : ""}`);
          setRestore(null);
        }}
      />
      <ConfirmationDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Delete everything?"
        destructive
        confirmLabel="Delete everything"
        busy={typed !== "DELETE"}
        description="This can’t be undone. Download a backup first. Type DELETE to confirm."
        onConfirm={async () => {
          if (typed !== "DELETE") return;
          await filesStore.clearAll();
          const r = store.clearAllData();
          if (r.ok) toast.success("All data cleared");
          setClearOpen(false);
        }}
      >
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" />
      </ConfirmationDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FilesTab({ data }: { data: AppData }) {
  const files = useFiles() ?? [];
  const [editing, setEditing] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirm, setConfirm] = React.useState(false);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">All uploaded files</h2>
          <p className="text-sm text-ink-muted">{files.length} files · {formatBytes(filesStore.totalBytes())} · upload more in <Link href="/profile#files" className="text-primary-ink hover:underline">Profile</Link> or any sub module</p>
        </div>
        {selected.size > 0 && <Button variant="danger" size="sm" onClick={() => setConfirm(true)}><Trash2 /> Delete {selected.size}</Button>}
      </div>
      {files.length === 0 ? (
        <p className="border-t border-border px-5 py-10 text-center text-sm text-ink-muted">No files uploaded yet.</p>
      ) : (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-ink-muted">
              <tr>
                <th className="w-10 px-4 py-2"><input type="checkbox" aria-label="Select all" className="accent-primary" checked={selected.size === files.length} onChange={(e) => setSelected(e.target.checked ? new Set(files.map((f) => f.id)) : new Set())} /></th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Size</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {files.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2"><input type="checkbox" aria-label={`Select ${f.name}`} className="accent-primary" checked={selected.has(f.id)} onChange={() => toggle(f.id)} /></td>
                  <td className="max-w-[220px] truncate px-3 py-2 font-medium text-ink"><FileText className="mr-1.5 inline size-3.5 text-primary" />{f.name}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-ink-muted">{fileLocation(f, data)}</td>
                  <td className="px-3 py-2 text-ink-muted">{KIND_LABEL[f.kind]}</td>
                  <td className="px-3 py-2 text-right text-ink-muted tabular">{formatBytes(f.size)}</td>
                  <td className="px-3 py-2 text-ink-muted">{formatShortDate(f.updatedAt.slice(0, 10))}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-0.5">
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f.id)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Download ${f.name}`} onClick={() => downloadStoredFile(f)}><Download /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FileEditor file={editing ? files.find((f) => f.id === editing) ?? null : null} onClose={() => setEditing(null)} />
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive
        title={`Delete ${selected.size} file${selected.size === 1 ? "" : "s"}?`}
        description="They’ll be removed from this device. This can’t be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          await filesStore.removeMany([...selected]);
          store.log("Files deleted (bulk)", `${selected.size} file(s)`);
          toast.success("Files deleted");
          setSelected(new Set());
          setConfirm(false);
        }}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function RecordsTab({ data }: { data: AppData }) {
  const mains = mainOptionsWithHistory(data);
  const [main, setMain] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const matches = [...data.records]
    .filter((r) => (!main || r.mainModuleId === main) && (!from || r.date >= from) && (!to || r.date <= to))
    .sort(byNewest);
  const filtered = !!(main || from || to);

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-ink">Bulk manage attendance records</h2>
      <p className="mt-1 text-sm text-ink-muted">Filter, then delete old records — for example at the end of a semester (download a backup first).</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="rc-main" className="text-xs font-medium text-ink-muted">Main module</label>
          <select id="rc-main" value={main} onChange={(e) => setMain(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink">
            <option value="">All</option>
            {mains.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="rc-from" className="text-xs font-medium text-ink-muted">From</label>
          <Input id="rc-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="rc-to" className="text-xs font-medium text-ink-muted">To</label>
          <Input id="rc-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <p className="text-sm text-ink"><strong className="tabular">{matches.length}</strong> of {data.records.length} records match</p>
        <Button variant="danger" size="sm" disabled={!filtered || !matches.length} onClick={() => setConfirm(true)}><Trash2 /> Delete matching</Button>
      </div>
      <ul className="mt-4 max-h-[420px] divide-y divide-border overflow-auto rounded-lg border border-border">
        {matches.slice(0, 200).map((r) => (
          <li key={r.id}>
            <Link href={`/history/${r.id}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
              <span className="flex-1 truncate text-ink">{formatLongDate(r.date)} · {formatTime(r.takenAt)} · P{r.session} — {r.mainModuleName} / {r.subModuleName}</span>
              <span className="text-xs text-ink-muted tabular">{r.present.length}/{r.rollNumbers.length}</span>
            </Link>
          </li>
        ))}
        {matches.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-muted">No records.</li>}
      </ul>
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive
        title={`Delete ${matches.length} records?`}
        description="They will be permanently removed from Attendance History and student percentages will be recalculated."
        confirmLabel="Delete records"
        onConfirm={() => {
          const r = store.deleteRecords(matches.map((x) => x.id));
          if (r.ok) toast.success(`${r.data} records deleted`);
          else toast.error(r.error);
          setConfirm(false);
        }}
      />
    </Card>
  );
}

function ActivityTab({ data }: { data: AppData }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Activity log</h2>
          <p className="text-sm text-ink-muted">The last {data.activity.length} changes made on this device.</p>
        </div>
        {data.activity.length > 0 && <Button variant="ghost" size="sm" onClick={() => store.clearActivity()}>Clear log</Button>}
      </div>
      <ul className="max-h-[560px] divide-y divide-border overflow-auto border-t border-border">
        {data.activity.map((a) => (
          <li key={a.id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{a.action}</p>
              {a.detail && <p className="truncate text-xs text-ink-muted">{a.detail}</p>}
            </div>
            <time className="shrink-0 text-xs text-ink-subtle tabular" dateTime={a.at}>{new Date(a.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
          </li>
        ))}
        {data.activity.length === 0 && <li className="px-5 py-10 text-center text-sm text-ink-muted">No activity yet.</li>}
      </ul>
    </Card>
  );
}
