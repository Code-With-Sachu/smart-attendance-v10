"use client";

import * as React from "react";
import { FileSpreadsheet, Link2, Loader2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatRoll, rollWidth } from "@/lib/format";
import {
  ACCEPT_ATTR,
  analyseSheet,
  buildStudents,
  parseGoogleSheetLink,
  parseRosterFile,
  RosterError,
  type Numbering,
  type ParsedFile,
} from "@/lib/roster/parse";
import type { Student } from "@/lib/types";

export interface ImportResult {
  students: Student[];
  fileName: string;
  columns: string[];
}

/**
 * Upload a student file (Excel / Google Sheet / CSV / PDF / Word / text), preview the
 * detected roll + name columns, then hand the clean list to `onImport`.
 */
export function StudentImporter({
  onImport,
  confirmLabel = "Import",
  title = "Upload student file",
  description = "Excel, Google Sheets, CSV, PDF, Word or text. One row per student — a name column is all you need.",
  className,
}: {
  onImport: (r: ImportResult) => boolean | void;
  confirmLabel?: string;
  title?: string;
  description?: string;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<"file" | "link" | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [link, setLink] = React.useState("");
  const [linkError, setLinkError] = React.useState<string>();
  const [parsed, setParsed] = React.useState<ParsedFile | null>(null);

  async function handle(promise: Promise<ParsedFile>, kind: "file" | "link") {
    setBusy(kind);
    try {
      const p = await promise;
      if (!p.sheets.length) throw new RosterError("No rows were found in that file.");
      setParsed(p);
      if (kind === "link") setLink("");
    } catch (err) {
      const msg = err instanceof RosterError ? err.message : "That file couldn’t be read. Try saving it as .xlsx or .csv.";
      if (kind === "link") setLinkError(msg);
      else toast.error(msg);
      if (!(err instanceof RosterError)) console.error(err);
    } finally {
      setBusy(null);
    }
  }

  function onFiles(files: FileList | null) {
    const f = files?.[0];
    if (f) void handle(parseRosterFile(f), "file");
  }

  return (
    <div className={className}>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "mt-4 flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          drag ? "border-primary bg-primary-soft" : "border-slate-300 bg-slate-50",
        )}
      >
        <div className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
          <FileSpreadsheet className="size-5" aria-hidden />
        </div>
        <Button className="mt-3" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
          {busy === "file" ? <Loader2 className="animate-spin" /> : <Upload />} {busy === "file" ? "Reading file…" : "Upload File"}
        </Button>
        <p className="mt-2 text-xs text-ink-muted">or drag &amp; drop · .xlsx .xls .csv .ods .pdf .docx .txt</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload student file"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <form
        className="mt-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!link.trim()) return setLinkError("Paste a Google Sheets link.");
          setLinkError(undefined);
          void handle(parseGoogleSheetLink(link), "link");
        }}
      >
        <label htmlFor="sheet-link" className="block text-sm font-medium text-ink">
          Or import from a Google Sheets link
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input
              id="sheet-link"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className="pl-9"
              invalid={!!linkError}
              aria-describedby={linkError ? "sheet-link-error" : "sheet-link-hint"}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={busy !== null}>
            {busy === "link" ? <Loader2 className="animate-spin" /> : null} Import
          </Button>
        </div>
        {linkError ? (
          <p id="sheet-link-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">{linkError}</p>
        ) : (
          <p id="sheet-link-hint" className="mt-1.5 text-xs text-ink-muted">Share the sheet as “Anyone with the link → Viewer”.</p>
        )}
      </form>

      <ImportPreview
        parsed={parsed}
        confirmLabel={confirmLabel}
        onClose={() => setParsed(null)}
        onConfirm={(r) => {
          if (onImport(r) !== false) setParsed(null);
        }}
      />
    </div>
  );
}

const selectCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-ink shadow-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0";

function ImportPreview({
  parsed,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  parsed: ParsedFile | null;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (r: ImportResult) => void;
}) {
  const [sheetIdx, setSheetIdx] = React.useState(0);
  const [rollCol, setRollCol] = React.useState<number | null>(null);
  const [nameCol, setNameCol] = React.useState<number | null>(null);
  const [numbering, setNumbering] = React.useState<Numbering>("sequential");

  // Pick the sheet with the most rows, then auto-detect its columns.
  React.useEffect(() => {
    if (!parsed) return;
    let best = 0;
    parsed.sheets.forEach((s, i) => {
      if (s.rows.length > parsed.sheets[best]!.rows.length) best = i;
    });
    setSheetIdx(best);
  }, [parsed]);

  const analysis = React.useMemo(() => (parsed?.sheets[sheetIdx] ? analyseSheet(parsed.sheets[sheetIdx]!.rows) : null), [parsed, sheetIdx]);

  React.useEffect(() => {
    if (!analysis) return;
    setRollCol(analysis.rollCol);
    setNameCol(analysis.nameCol);
    // Default to the file's roll numbers only when they are clean; otherwise 1 → N.
    const probe = buildStudents(analysis, { rollCol: analysis.rollCol, nameCol: analysis.nameCol, numbering: "file" });
    const isSerial = analysis.rollCol !== null && /^(s\.?\s*l?\.?\s*no|sl|sno|serial|sr|#|no\.?$)/i.test(analysis.columns[analysis.rollCol] ?? "");
    setNumbering(analysis.rollCol !== null && probe.rollColumnUsable && !isSerial ? "file" : "sequential");
  }, [analysis]);

  const result = React.useMemo(
    () => (analysis ? buildStudents(analysis, { rollCol, nameCol, numbering: rollCol === null ? "sequential" : numbering }) : null),
    [analysis, rollCol, nameCol, numbering],
  );

  if (!parsed || !analysis || !result) return <Modal open={false} onOpenChange={onClose} title="" />;

  const students = result.students;
  const width = rollWidth(students.map((s) => s.roll));
  const detailKeys = Array.from(new Set(students.slice(0, 20).flatMap((s) => Object.keys(s.details ?? {})))).slice(0, 2);
  const rollRange = students.length ? `${formatRoll(students[0]!.roll, width)}–${formatRoll(students[students.length - 1]!.roll, width)}` : "—";

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Check the student list"
      description={`${parsed.fileName} · ${parsed.kind}`}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!students.length}
            onClick={() => onConfirm({ students, fileName: parsed.fileName, columns: analysis.columns })}
          >
            {confirmLabel} {students.length} student{students.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {parsed.sheets.length > 1 && (
            <div className="space-y-1.5 sm:col-span-3">
              <label htmlFor="imp-sheet" className="block text-sm font-medium text-ink">Sheet / table</label>
              <select id="imp-sheet" className={selectCls} value={sheetIdx} onChange={(e) => setSheetIdx(Number(e.target.value))}>
                {parsed.sheets.map((s, i) => (
                  <option key={i} value={i}>{s.name} ({s.rows.length} rows)</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="imp-name" className="block text-sm font-medium text-ink">Student name column</label>
            <select id="imp-name" className={selectCls} value={nameCol ?? ""} onChange={(e) => setNameCol(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">— No names —</option>
              {analysis.columns.map((c, i) => (
                <option key={i} value={i}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="imp-roll" className="block text-sm font-medium text-ink">Roll number column</label>
            <select id="imp-roll" className={selectCls} value={rollCol ?? ""} onChange={(e) => setRollCol(e.target.value === "" ? null : Number(e.target.value))}>
              <option value="">— None —</option>
              {analysis.columns.map((c, i) => (
                <option key={i} value={i}>{c}</option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 block text-sm font-medium text-ink">Roll numbers</legend>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="imp-num" className="accent-primary" checked={numbering === "sequential" || rollCol === null} onChange={() => setNumbering("sequential")} />
              Number 1 to N
            </label>
            <label className={cn("flex items-center gap-2 text-sm", rollCol === null ? "text-ink-subtle" : "text-ink")}>
              <input type="radio" name="imp-num" className="accent-primary" disabled={rollCol === null} checked={numbering === "file" && rollCol !== null} onChange={() => setNumbering("file")} />
              Use the file’s column
            </label>
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-ink">
          <span><strong className="tabular">{students.length}</strong> students found</span>
          <span className="tabular">Roll numbers {rollRange}</span>
        </div>

        {result.warnings.map((w) => (
          <p key={w} className="flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
          </p>
        ))}

        <div className="max-h-[42dvh] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Roll</th>
                <th scope="col" className="px-3 py-2">Name</th>
                {detailKeys.map((k) => (
                  <th key={k} scope="col" className="hidden px-3 py-2 sm:table-cell">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.slice(0, 100).map((s) => (
                <tr key={s.roll}>
                  <td className="px-3 py-1.5 font-semibold text-ink tabular">{formatRoll(s.roll, width)}</td>
                  <td className="px-3 py-1.5 text-ink">{s.name || <span className="text-ink-subtle">—</span>}</td>
                  {detailKeys.map((k) => (
                    <td key={k} className="hidden px-3 py-1.5 text-ink-muted sm:table-cell">{s.details?.[k] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {students.length > 100 && <p className="border-t border-border px-3 py-2 text-xs text-ink-muted">…and {students.length - 100} more</p>}
          {!students.length && <p className="px-3 py-6 text-center text-sm text-ink-muted">No students found with these columns. Try another column or sheet.</p>}
        </div>
      </div>
    </Modal>
  );
}
