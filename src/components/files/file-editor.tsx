"use client";

import * as React from "react";
import { Columns3, Download, FileDown, Plus, RefreshCw, Rows3, Save, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAppData } from "@/lib/store/hooks";
import { filesStore } from "@/lib/files/store";
import { FILE_ACCEPT, formatBytes, sheetToCsv } from "@/lib/files/extract";
import { KIND_LABEL, ownerKey, type FileOwner, type FileSheet, type StoredFile } from "@/lib/files/types";
import { byNumber } from "@/lib/store/selectors";
import { downloadText, safeFileName } from "@/lib/report";
import { cn } from "@/lib/utils";

const ROW_PAGE = 200;

/** Edit a file's content (text or tables), name, notes and location. */
export function FileEditor({ file, onClose }: { file: StoredFile | null; onClose: () => void }) {
  if (!file) return <Modal open={false} onOpenChange={onClose} title="" />;
  return <EditorInner key={file.id + file.updatedAt} file={file} onClose={onClose} />;
}

function EditorInner({ file, onClose }: { file: StoredFile; onClose: () => void }) {
  const data = useAppData();
  const [tab, setTab] = React.useState<"content" | "details">("content");
  const [name, setName] = React.useState(file.name);
  const [notes, setNotes] = React.useState(file.notes);
  const [text, setText] = React.useState(file.text);
  const [sheets, setSheets] = React.useState<FileSheet[]>(() => file.sheets?.map((s) => ({ name: s.name, rows: s.rows.map((r) => [...r]) })) ?? []);
  const [sheetIdx, setSheetIdx] = React.useState(0);
  const [owner, setOwner] = React.useState(ownerKey(file.owner));
  const [rowsShown, setRowsShown] = React.useState(ROW_PAGE);
  const [saving, setSaving] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const replaceRef = React.useRef<HTMLInputElement>(null);

  const isTable = file.kind === "table";
  const dirty =
    name !== file.name ||
    notes !== file.notes ||
    text !== file.text ||
    owner !== ownerKey(file.owner) ||
    (isTable && JSON.stringify(sheets) !== JSON.stringify(file.sheets ?? []));

  const imageUrl = React.useMemo(() => (file.kind === "image" && file.blob ? URL.createObjectURL(file.blob) : null), [file]);
  React.useEffect(() => () => void (imageUrl && URL.revokeObjectURL(imageUrl)), [imageUrl]);

  function parseOwner(k: string): FileOwner {
    return k === "profile" ? { kind: "profile" } : { kind: "sub", subModuleId: k.slice(4) };
  }

  async function save() {
    setSaving(true);
    const r = await filesStore.update(file.id, { name, notes, text, ...(isTable ? { sheets } : {}), owner: parseOwner(owner) });
    setSaving(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("File saved");
    onClose();
  }

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  // ---- table helpers ----
  const sheet = sheets[sheetIdx];
  const width = Math.max(1, ...(sheet?.rows.map((r) => r.length) ?? [1]));
  const patchSheet = (fn: (rows: string[][]) => string[][]) =>
    setSheets((all) => all.map((s, i) => (i === sheetIdx ? { ...s, rows: fn(s.rows.map((r) => [...r])) } : s)));
  const setCell = (r: number, c: number, v: string) =>
    patchSheet((rows) => {
      while (rows[r]!.length <= c) rows[r]!.push("");
      rows[r]![c] = v;
      return rows;
    });

  async function exportXlsx() {
    const XLSX = await import("@e965/xlsx");
    const wb = XLSX.utils.book_new();
    sheets.forEach((s, i) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), (s.name || `Sheet${i + 1}`).slice(0, 31)));
    XLSX.writeFile(wb, `${safeFileName(name.replace(/\.[a-z0-9]+$/i, ""))}.xlsx`);
  }

  const groups = data
    ? [...data.mainModules].sort(byNumber).map((m) => ({ main: m, subs: data.subModules.filter((s) => s.mainModuleId === m.id).sort(byNumber) })).filter((g) => g.subs.length)
    : [];

  return (
    <>
      <Modal
        open
        onOpenChange={(o) => !o && requestClose()}
        title={file.name}
        description={`${KIND_LABEL[file.kind]} · ${formatBytes(file.size)}${file.editCount ? ` · edited ${file.editCount}×` : ""}`}
        className="sm:max-w-4xl"
        footer={
          <>
            <Button variant="secondary" onClick={requestClose}>
              <X /> {dirty ? "Cancel" : "Close"}
            </Button>
            <Button onClick={save} disabled={!dirty || saving}>
              <Save /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        <div role="tablist" className="mb-4 inline-flex rounded-lg border border-border bg-slate-50 p-1 text-sm">
          {(["content", "details"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1 font-medium capitalize", tab === t ? "bg-card text-ink shadow-sm" : "text-ink-muted")}>
              {t === "content" ? (isTable ? "Edit table" : file.kind === "image" ? "Preview" : "Edit content") : "Name, notes & location"}
            </button>
          ))}
        </div>

        {tab === "content" && (
          <div className="space-y-3">
            {file.extractWarning && (
              <p className="flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-ink">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {file.extractWarning}
              </p>
            )}

            {isTable ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {sheets.length > 1 && (
                    <select aria-label="Sheet" value={sheetIdx} onChange={(e) => { setSheetIdx(Number(e.target.value)); setRowsShown(ROW_PAGE); }} className="h-8 rounded-lg border border-border bg-card px-2 text-sm text-ink">
                      {sheets.map((s, i) => (
                        <option key={i} value={i}>{s.name} ({s.rows.length})</option>
                      ))}
                    </select>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => patchSheet((rows) => [...rows, Array(width).fill("")])}><Rows3 /> Add row</Button>
                  <Button size="sm" variant="secondary" onClick={() => patchSheet((rows) => rows.map((r, i) => [...r, ...Array(Math.max(0, width - r.length)).fill(""), i === 0 ? `Column ${width + 1}` : ""]))}><Columns3 /> Add column</Button>
                  <span className="ml-auto text-xs text-ink-muted tabular">{sheet?.rows.length ?? 0} rows × {width} columns</span>
                </div>
                {sheet ? (
                  <div className="max-h-[50dvh] overflow-auto rounded-lg border border-border">
                    <table className="text-sm">
                      <tbody>
                        {sheet.rows.slice(0, rowsShown).map((row, r) => (
                          <tr key={r} className={cn(r === 0 && "sticky top-0 z-10 bg-slate-100 font-semibold")}>
                            <td className="sticky left-0 z-[5] w-10 border-b border-r border-border bg-slate-50 px-1 text-center text-[11px] text-ink-subtle tabular">
                              <button type="button" className="group relative w-full" aria-label={`Delete row ${r + 1}`} onClick={() => patchSheet((rows) => rows.filter((_, i) => i !== r))}>
                                <span className="group-hover:hidden">{r + 1}</span>
                                <Trash2 className="mx-auto hidden size-3 text-danger group-hover:block" />
                              </button>
                            </td>
                            {Array.from({ length: width }).map((_, c) => (
                              <td key={c} className="border-b border-r border-border p-0">
                                <input
                                  value={row[c] ?? ""}
                                  onChange={(e) => setCell(r, c, e.target.value)}
                                  aria-label={`Row ${r + 1}, column ${c + 1}`}
                                  className={cn("h-8 w-36 min-w-0 bg-transparent px-2 text-ink outline-none focus:bg-primary-soft", r === 0 && "font-semibold")}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sheet.rows.length > rowsShown && (
                      <div className="p-2 text-center">
                        <Button size="sm" variant="ghost" onClick={() => setRowsShown((n) => n + ROW_PAGE)}>Show {Math.min(ROW_PAGE, sheet.rows.length - rowsShown)} more rows</Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">No table data found.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={exportXlsx}><FileDown /> Download edited .xlsx</Button>
                  {sheet && <Button size="sm" variant="secondary" onClick={() => downloadText(sheetToCsv(sheet.rows), `${safeFileName(name.replace(/\.[a-z0-9]+$/i, ""))}.csv`, "text/csv;charset=utf-8")}><FileDown /> Download .csv</Button>}
                </div>
              </>
            ) : file.kind === "image" ? (
              imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={name} className="mx-auto max-h-[50dvh] rounded-lg border border-border object-contain" />
              ) : (
                <p className="text-sm text-ink-muted">Preview unavailable.</p>
              )
            ) : (
              <>
                <label htmlFor="file-text" className="sr-only">File content</label>
                <textarea
                  id="file-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={file.kind === "other" ? "Type a description or the contents of this file so the assistant can use it." : "File content…"}
                  className="h-[50dvh] w-full resize-y rounded-lg border border-border bg-card p-3 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  spellCheck
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => downloadText(text, `${safeFileName(name.replace(/\.[a-z0-9]+$/i, ""))}.txt`)}><FileDown /> Download edited text</Button>
                  <span className="ml-auto text-xs text-ink-muted tabular">{text.length.toLocaleString()} characters</span>
                </div>
              </>
            )}
            {(file.kind === "image" || file.kind === "other") && (
              <Field label="Description (read by the assistant)" htmlFor="file-notes-c">
                <textarea id="file-notes-c" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-card p-2 text-sm text-ink" placeholder="What is in this file?" />
              </Field>
            )}
          </div>
        )}

        {tab === "details" && (
          <div className="space-y-4">
            <Field label="File name" htmlFor="file-name" required>
              <Input id="file-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Notes" htmlFor="file-notes" hint="Anything about this file — the AI assistant reads these notes too.">
              <textarea id="file-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} className="w-full rounded-lg border border-border bg-card p-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </Field>
            <Field label="Location" htmlFor="file-owner">
              <select id="file-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink">
                <option value="profile">Profile (my files)</option>
                {groups.map((g) => (
                  <optgroup key={g.main.id} label={g.main.name}>
                    {g.subs.map((s) => (
                      <option key={s.id} value={`sub:${s.id}`}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="secondary" size="sm" onClick={() => replaceRef.current?.click()}><RefreshCw /> Replace with a new version</Button>
              {file.blob && (
                <Button variant="secondary" size="sm" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(file.blob!); a.download = file.originalName; a.click(); }}>
                  <Download /> Download original
                </Button>
              )}
              <input
                ref={replaceRef}
                type="file"
                accept={FILE_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const r = await filesStore.replace(file.id, f);
                  if (r.ok) toast.success("File replaced");
                  else toast.error(r.error);
                }}
              />
            </div>
            <p className="text-xs text-ink-muted">Original: {file.originalName} · uploaded {new Date(file.createdAt).toLocaleString("en-GB")}</p>
          </div>
        )}
        {isTable && tab === "content" && sheets.length === 0 && (
          <Button size="sm" variant="secondary" onClick={() => setSheets([{ name: "Sheet1", rows: [["Column 1"]] }])}><Plus /> Start a table</Button>
        )}
      </Modal>
      <ConfirmationDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Discard your changes?"
        description="You have unsaved edits to this file."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
      />
    </>
  );
}
