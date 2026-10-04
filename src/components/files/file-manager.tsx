"use client";

import * as React from "react";
import { Download, FileImage, FileSpreadsheet, FileText, FileType2, File as FileIcon, Loader2, Pencil, Search, Trash2, TriangleAlert, Upload, FolderUp } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { filesStore, useFiles } from "@/lib/files/store";
import { FILE_ACCEPT, formatBytes } from "@/lib/files/extract";
import { KIND_LABEL, ownerKey, type FileKind, type FileOwner, type StoredFile } from "@/lib/files/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FileEditor } from "./file-editor";

export const KIND_ICON: Record<FileKind, typeof FileIcon> = {
  table: FileSpreadsheet,
  text: FileText,
  document: FileType2,
  pdf: FileText,
  image: FileImage,
  other: FileIcon,
};

export function downloadStoredFile(f: StoredFile) {
  if (!f.blob) return toast.error("The original file isn’t available on this device.");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(f.blob);
  a.download = f.name.includes(".") ? f.name : `${f.name}${f.ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/**
 * Multi-file upload + list + edit, used in Profile and in each sub module.
 * Files are stored in this browser (IndexedDB) and their content is readable by the AI assistant.
 */
export function FileManager({ owner, title, description, className, id }: { owner: FileOwner; title: string; description: string; className?: string; id?: string }) {
  const all = useFiles();
  const files = React.useMemo(() => (all ?? []).filter((f) => ownerKey(f.owner) === ownerKey(owner)), [all, owner]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(0);
  const [drag, setDrag] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<StoredFile | null>(null);

  async function upload(list: FileList | File[] | null) {
    const arr = Array.from(list ?? []);
    if (!arr.length) return;
    setBusy(arr.length);
    const { added, errors } = await filesStore.upload(owner, arr);
    setBusy(0);
    if (added.length) toast.success(`Uploaded ${added.length} file${added.length === 1 ? "" : "s"}`, { description: added.map((f) => f.name).slice(0, 4).join(", ") });
    if (errors.length) toast.error(`${errors.length} file${errors.length === 1 ? "" : "s"} not uploaded`, { description: errors.slice(0, 4).join("\n") });
    const warned = added.filter((f) => f.extractWarning);
    if (warned.length) toast.message(`${warned.length} file${warned.length === 1 ? "" : "s"} saved without readable text`, { description: warned[0]!.extractWarning });
  }

  const shown = q.trim() ? files.filter((f) => `${f.name} ${f.notes}`.toLowerCase().includes(q.trim().toLowerCase())) : files;
  const editingFile = editing ? files.find((f) => f.id === editing) ?? null : null;

  return (
    <Card id={id} className={cn("scroll-mt-24 p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <FolderUp className="size-4 text-primary" aria-hidden /> {title}
            {files.length > 0 && <span className="rounded-md bg-slate-100 px-1.5 text-xs font-medium text-ink-muted tabular">{files.length}</span>}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void upload(e.dataTransfer.files);
        }}
        className={cn("mt-4 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors sm:flex-row sm:text-left", drag ? "border-primary bg-primary-soft" : "border-slate-300 bg-slate-50")}
      >
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">Drop files here or choose several at once</p>
          <p className="text-xs text-ink-muted">PDF, Word, Excel, CSV, text, images · up to 15 MB each</p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={busy > 0}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? `Uploading ${busy}…` : "Upload files"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label={`Upload files to ${title}`}
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 5 && (
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" className="pl-9" aria-label="Search files" />
        </div>
      )}

      {all === null ? (
        <div className="mt-4 space-y-2">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      ) : files.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-ink-muted">No files yet. Uploaded files can be edited here and the AI assistant can read them.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {shown.map((f) => {
            const Icon = KIND_ICON[f.kind];
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <button type="button" onClick={() => setEditing(f.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-ink hover:underline">{f.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-ink-muted tabular">
                    {KIND_LABEL[f.kind]} · {formatBytes(f.size)} · {f.editCount ? `edited ${formatShortDate(f.updatedAt.slice(0, 10))}` : formatShortDate(f.createdAt.slice(0, 10))}
                    {f.extractWarning && <TriangleAlert className="size-3 text-warn-ink" aria-label={f.extractWarning} />}
                  </p>
                </button>
                <div className="flex shrink-0 gap-0.5">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f.id)}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Download ${f.name}`} onClick={() => downloadStoredFile(f)}><Download /></Button>
                  <Button size="icon-sm" variant="ghost" className="hover:text-danger" aria-label={`Delete ${f.name}`} onClick={() => setDeleting(f)}><Trash2 /></Button>
                </div>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-ink-muted">No files match “{q}”.</li>}
        </ul>
      )}
      {!filesStore.persistent && <p className="mt-2 text-xs text-warn-ink">This browser blocks file storage — files will be lost when you close the tab.</p>}

      <FileEditor file={editingFile} onClose={() => setEditing(null)} />
      <ConfirmationDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title="Delete this file?"
        description={`“${deleting?.name ?? ""}” will be removed from this device. This can’t be undone.`}
        confirmLabel="Delete file"
        onConfirm={async () => {
          if (!deleting) return;
          await filesStore.remove(deleting.id);
          toast.success("File deleted");
          setDeleting(null);
        }}
      />
    </Card>
  );
}
