/**
 * Student-file parsing — runs entirely in the browser.
 *
 * Every supported format is turned into one or more "sheets" (a 2-D table of strings).
 * `analyseSheet` then finds the header row and guesses the roll-number and name columns,
 * and `buildStudents` turns the chosen columns into a clean { roll, name } list.
 *
 * Supported: Excel (.xlsx .xls .xlsm), OpenDocument (.ods), CSV/TSV, Numbers,
 * Google Sheets (link or downloaded file), Word (.docx), PDF, plain text and JSON.
 */

import type { Student } from "@/lib/types";
import { cleanStudentName, MAX_ROLLS_PER_MODULE } from "@/lib/validation";

export type Table = string[][];
export interface ParsedSheet {
  name: string;
  rows: Table;
}
export interface ParsedFile {
  fileName: string;
  kind: string;
  sheets: ParsedSheet[];
}

export const ACCEPTED_EXTENSIONS = [
  ".xlsx", ".xls", ".xlsm", ".xlsb", ".ods", ".csv", ".tsv", ".numbers",
  ".docx", ".pdf", ".txt", ".json", ".doc", ".rtf",
];
export const ACCEPT_ATTR = [
  ...ACCEPTED_EXTENSIONS,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/json",
].join(",");

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export class RosterError extends Error {}

const ext = (name: string) => (name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "");

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

export async function parseRosterFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_FILE_BYTES) throw new RosterError("That file is larger than 10 MB. Remove extra sheets or images and try again.");
  if (file.size === 0) throw new RosterError("That file is empty.");
  const e = ext(file.name);
  const buf = await file.arrayBuffer();

  if (e === ".doc") throw new RosterError("Old Word .doc files can’t be read in the browser. Open it in Word or Google Docs and save/download it as .docx or PDF.");
  if (e === ".pdf" || file.type === "application/pdf") return { fileName: file.name, kind: "PDF", sheets: await parsePdf(buf) };
  if (e === ".docx" || file.type.includes("wordprocessingml")) return { fileName: file.name, kind: "Word document", sheets: await parseDocx(buf) };
  if (e === ".json" || file.type === "application/json") return { fileName: file.name, kind: "JSON", sheets: [parseJson(new TextDecoder().decode(buf))] };
  if (e === ".txt" || e === ".rtf") return { fileName: file.name, kind: "Text", sheets: [{ name: "Text", rows: linesToRows(decodeText(buf).split(/\r?\n/)) }] };
  return { fileName: file.name, kind: spreadsheetKind(e), sheets: await parseSpreadsheet(buf) };
}

/** Google Sheets / Drive link → fetched through our own API route (avoids CORS), then parsed as a spreadsheet. */
export async function parseGoogleSheetLink(url: string): Promise<ParsedFile> {
  const trimmed = url.trim();
  if (!/^https:\/\/(docs|drive)\.google\.com\//i.test(trimmed)) throw new RosterError("Paste a Google Sheets link that starts with https://docs.google.com/spreadsheets/…");
  let res: Response;
  try {
    res = await fetch(`/api/sheet?url=${encodeURIComponent(trimmed)}`);
  } catch {
    throw new RosterError("Couldn’t reach Google Sheets. Check your connection and try again.");
  }
  if (!res.ok) {
    const msg = await res.json().then((j: { error?: string }) => j.error).catch(() => undefined);
    throw new RosterError(msg ?? "Couldn’t open that Google Sheet.");
  }
  const title = decodeURIComponent(res.headers.get("x-sheet-title") ?? "") || "Google Sheet";
  const buf = await res.arrayBuffer();
  return { fileName: title, kind: "Google Sheet", sheets: await parseSpreadsheet(buf) };
}

/* ------------------------------------------------------------------ */
/* Format readers                                                      */
/* ------------------------------------------------------------------ */

function spreadsheetKind(e: string) {
  if (e === ".csv" || e === ".tsv") return "CSV";
  if (e === ".ods") return "OpenDocument sheet";
  if (e === ".numbers") return "Numbers sheet";
  return "Spreadsheet";
}

function decodeText(buf: ArrayBuffer): string {
  const text = new TextDecoder("utf-8").decode(buf);
  // Very small RTF clean-up: drop control words and braces.
  if (text.startsWith("{\\rtf")) return text.replace(/\\par[d]?/g, "\n").replace(/\{\*?\\[^{}]+}|[{}]|\\[a-z]+-?\d* ?/gi, "");
  return text;
}

export async function parseSpreadsheet(buf: ArrayBuffer): Promise<ParsedSheet[]> {
  const XLSX = await import("@e965/xlsx");
  let wb;
  try {
    wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true, dense: true });
  } catch {
    throw new RosterError("This spreadsheet couldn’t be read. Save it as .xlsx or .csv and try again.");
  }
  const sheets: ParsedSheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "", blankrows: false });
    const table = tidy(rows.map((r) => (r as unknown[]).map((c) => (c == null ? "" : String(c)))));
    if (table.length) sheets.push({ name, rows: table });
  }
  return sheets;
}

async function parseDocx(buf: ArrayBuffer): Promise<ParsedSheet[]> {
  const mammoth = await import("mammoth");
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ arrayBuffer: buf })).value;
  } catch {
    throw new RosterError("This Word file couldn’t be read. Make sure it’s a .docx file.");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sheets: ParsedSheet[] = [];
  doc.querySelectorAll("table").forEach((t, i) => {
    const rows = tidy(
      Array.from(t.querySelectorAll("tr")).map((tr) => Array.from(tr.querySelectorAll("th,td")).map((c) => c.textContent ?? "")),
    );
    if (rows.length) sheets.push({ name: `Table ${i + 1}`, rows });
  });
  // Paragraph/list text (for documents that are just a list of names).
  doc.querySelectorAll("table").forEach((t) => t.remove());
  const lines = Array.from(doc.body.querySelectorAll("p,li,h1,h2,h3,h4")).map((el) => el.textContent ?? "");
  const textRows = linesToRows(lines);
  if (textRows.length >= 2) sheets.push({ name: sheets.length ? "Document text" : "Document", rows: textRows });
  return sheets;
}

async function parsePdf(buf: ArrayBuffer): Promise<ParsedSheet[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  } catch {
    throw new RosterError("This PDF couldn’t be opened. If it’s password-protected, remove the password and try again.");
  }
  const rows: Table = [];
  const pages = Math.min(pdf.numPages, 40);
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    type Item = { str: string; x: number; y: number; w: number; h: number };
    const items: Item[] = [];
    for (const it of content.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
      if (!it.str || !it.transform || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4]!, y: it.transform[5]!, w: it.width ?? 0, h: Math.abs(it.height ?? it.transform[3] ?? 10) });
    }
    // Group into lines by y (top → bottom), then into cells by horizontal gaps.
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: Item[][] = [];
    for (const it of items) {
      const line = lines[lines.length - 1];
      if (line && Math.abs(line[0]!.y - it.y) <= Math.max(2, it.h * 0.4)) line.push(it);
      else lines.push([it]);
    }
    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let cur = "";
      let lastEnd = -Infinity;
      for (const it of line) {
        const gap = it.x - lastEnd;
        if (cur && gap > Math.max(8, it.h * 1.2)) {
          cells.push(cur);
          cur = it.str;
        } else cur += (cur && gap > it.h * 0.15 && !cur.endsWith(" ") ? " " : "") + it.str;
        lastEnd = it.x + it.w;
      }
      if (cur) cells.push(cur);
      rows.push(cells);
    }
  }
  if (!rows.length) throw new RosterError("No text was found in this PDF. Scanned/photo PDFs can’t be read — upload the original sheet or a .xlsx/.csv instead.");
  // A PDF made from a plain list may come through as single-cell lines like "1. Anu".
  const singleCell = rows.filter((r) => r.length === 1).length / rows.length > 0.7;
  return [{ name: "PDF", rows: tidy(singleCell ? linesToRows(rows.map((r) => r.join(" "))) : rows) }];
}

function parseJson(text: string): ParsedSheet {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new RosterError("This JSON file isn’t valid.");
  }
  const arr = Array.isArray(data) ? data : Array.isArray((data as { students?: unknown })?.students) ? (data as { students: unknown[] }).students : null;
  if (!arr?.length) throw new RosterError("The JSON file should contain a list of students.");
  if (typeof arr[0] === "string") return { name: "JSON", rows: [["Name"], ...arr.map((s) => [String(s)])] };
  const keys = Array.from(new Set(arr.flatMap((o) => (o && typeof o === "object" ? Object.keys(o) : []))));
  return { name: "JSON", rows: [keys, ...arr.map((o) => keys.map((k) => String((o as Record<string, unknown>)?.[k] ?? "")))] };
}

/** Plain lines → rows. Handles "12. Name", "12 - Name", tab/comma separated, or a bare name per line. */
export function linesToRows(lines: string[]): Table {
  const rows: Table = [];
  for (const raw of lines) {
    const line = raw.replace(/ /g, " ").trim();
    if (!line) continue;
    if (line.includes("\t")) rows.push(line.split("\t"));
    else if (/ {2,}/.test(line)) rows.push(line.split(/ {2,}/));
    else if ((line.match(/,/g) ?? []).length >= 1 && !/^\d+[.)]/.test(line)) rows.push(line.split(","));
    else {
      const m = line.match(/^(\d{1,4})\s*[.):\-–|]?\s+(.+)$/);
      rows.push(m ? [m[1]!, m[2]!] : [line]);
    }
  }
  return tidy(rows);
}

/** Trim cells, drop empty rows and fully-empty columns. */
function tidy(rows: Table): Table {
  const trimmed = rows.map((r) => r.map((c) => String(c ?? "").replace(/\s+/g, " ").trim())).filter((r) => r.some(Boolean));
  const width = Math.max(0, ...trimmed.map((r) => r.length));
  const keep: number[] = [];
  for (let c = 0; c < width; c++) if (trimmed.some((r) => r[c])) keep.push(c);
  return trimmed.map((r) => keep.map((c) => r[c] ?? ""));
}

/* ------------------------------------------------------------------ */
/* Column detection                                                    */
/* ------------------------------------------------------------------ */

const ROLL_HEADER = /\b(roll|r\.?\s*no|roll\s*no|roll\s*number)\b/i;
const SERIAL_HEADER = /^(s\.?\s*l?\.?\s*no\.?|sl\.?|sno|serial(\s*no\.?)?|no\.?|#|sr\.?\s*no\.?|index)$/i;
const NAME_HEADER = /name/i;
const NOT_STUDENT_NAME = /(father|mother|parent|guardian|teacher|faculty|school|college|branch|dept|department|course|class|section)/i;
const ANY_HEADER = /(roll|name|reg|register|admission|adm|s\.?\s*no|sl\.?\s*no|serial|student|email|phone|mobile|branch|class|dob|gender)/i;

export interface SheetAnalysis {
  headerIndex: number | null;
  columns: string[];
  data: Table;
  rollCol: number | null;
  nameCol: number | null;
}

const colLetter = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export function analyseSheet(rows: Table): SheetAnalysis {
  // Header = first row (within the first 10) that looks like column titles.
  // Prefer the row with the most header-like cells; a title row ("CSE S3 class list") has one long cell and loses.
  const width = Math.max(1, ...rows.map((r) => r.length));
  let headerIndex: number | null = null;
  let bestHits = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i]!;
    const filled = r.filter(Boolean).length;
    if (width > 1 && filled < 2) continue;
    if (r.some((c) => /^\d+$/.test(c))) continue;
    const hits = r.filter((c) => c && ANY_HEADER.test(c) && c.length < 40).length;
    if (hits > bestHits) {
      bestHits = hits;
      headerIndex = i;
    }
  }
  const header = headerIndex !== null ? rows[headerIndex]! : [];
  const columns = Array.from({ length: width }, (_, i) => header[i]?.trim() || `Column ${colLetter(i)}`);
  const data = (headerIndex !== null ? rows.slice(headerIndex + 1) : rows).filter((r) => !isRepeatHeader(r, header));

  // Name column: header says "name" (but not father's name etc.); otherwise the most "wordy" column.
  let nameCol: number | null = null;
  const nameHeaders = columns.map((c, i) => ({ c, i })).filter(({ c }) => NAME_HEADER.test(c) && !NOT_STUDENT_NAME.test(c));
  if (nameHeaders.length) {
    nameCol = (nameHeaders.find(({ c }) => /student/i.test(c)) ?? nameHeaders.find(({ c }) => /^(full\s*)?name$/i.test(c)) ?? nameHeaders[0]!).i;
  } else {
    let best = -1;
    for (let c = 0; c < width; c++) {
      const vals = data.map((r) => r[c] ?? "").filter(Boolean);
      if (!vals.length) continue;
      const score = vals.filter((v) => /^[\p{L}][\p{L} .'\-]{1,}$/u.test(v)).length / data.length;
      if (score > best && score >= 0.5) {
        best = score;
        nameCol = c;
      }
    }
  }

  // Roll column: header says "roll", then serial-number headers, then any all-integer column.
  let rollCol: number | null = columns.findIndex((c) => ROLL_HEADER.test(c));
  if (rollCol < 0) rollCol = columns.findIndex((c) => SERIAL_HEADER.test(c.trim()));
  if (rollCol < 0) {
    rollCol = null;
    for (let c = 0; c < width; c++) {
      if (c === nameCol) continue;
      const vals = data.map((r) => r[c] ?? "").filter(Boolean);
      if (vals.length && vals.length >= data.length * 0.8 && vals.every((v) => /^\d{1,4}$/.test(v))) {
        rollCol = c;
        break;
      }
    }
  }
  return { headerIndex, columns, data, rollCol, nameCol };
}

function isRepeatHeader(row: string[], header: string[]) {
  return header.length > 0 && row.length === header.length && row.every((c, i) => c.toLowerCase() === (header[i] ?? "").toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Students                                                            */
/* ------------------------------------------------------------------ */

export type Numbering = "file" | "sequential";

export interface BuildResult {
  students: Student[];
  warnings: string[];
  /** True when the roll column can be used as-is (all valid and unique). */
  rollColumnUsable: boolean;
}

/** Parse "01", "1", "1.0", "CS-01" style roll values → 1. */
function rollValue(v: string): number | null {
  const s = v.trim();
  let m = s.match(/^0*(\d{1,4})(?:\.0+)?$/);
  if (!m) m = s.match(/^[A-Za-z]{0,6}[\s\-/]?0*(\d{1,4})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 9999 ? n : null;
}

const looksLikeTotalRow = (name: string) => /^(total|grand total|count|end of list|signature|principal|hod|class teacher)\b/i.test(name);

export function buildStudents(a: SheetAnalysis, opts: { rollCol: number | null; nameCol: number | null; numbering: Numbering }): BuildResult {
  const warnings: string[] = [];
  const rows = a.data.filter((r) => {
    const name = opts.nameCol !== null ? (r[opts.nameCol] ?? "") : "";
    const roll = opts.rollCol !== null ? (r[opts.rollCol] ?? "") : "";
    if (opts.nameCol !== null) return Boolean(name) && !looksLikeTotalRow(name) && !/^\d+$/.test(name);
    return Boolean(roll);
  });

  // Can the file's roll column be used directly?
  let rollColumnUsable = false;
  if (opts.rollCol !== null) {
    const vals = rows.map((r) => rollValue(r[opts.rollCol!] ?? ""));
    rollColumnUsable = vals.length > 0 && vals.every((v) => v !== null) && new Set(vals).size === vals.length;
  }
  const useFile = opts.numbering === "file" && opts.rollCol !== null;
  if (opts.numbering === "file" && opts.rollCol !== null && !rollColumnUsable)
    warnings.push("Some roll numbers in the file are missing, repeated or not numbers — those rows were skipped. Choose “Number 1 to N” to include everyone.");

  const detailCols = a.columns.map((c, i) => ({ c, i })).filter(({ i }) => i !== opts.nameCol && i !== opts.rollCol);
  const students: Student[] = [];
  const seen = new Set<number>();
  let n = 0;
  for (const r of rows) {
    let roll: number | null;
    if (useFile) {
      roll = rollValue(r[opts.rollCol!] ?? "");
      if (roll === null || seen.has(roll)) continue;
    } else roll = ++n;
    seen.add(roll);
    const details: Record<string, string> = {};
    for (const { c, i } of detailCols) if (r[i]) details[c] = r[i]!;
    if (useFile === false && opts.rollCol !== null && r[opts.rollCol]) details[a.columns[opts.rollCol]!] = r[opts.rollCol]!;
    students.push({
      roll,
      name: opts.nameCol !== null ? cleanStudentName(r[opts.nameCol] ?? "") : "",
      ...(Object.keys(details).length ? { details } : {}),
    });
  }
  students.sort((x, y) => x.roll - y.roll);
  if (students.length > MAX_ROLLS_PER_MODULE) {
    warnings.push(`Only the first ${MAX_ROLLS_PER_MODULE} students are kept (the file has ${students.length}).`);
    students.length = MAX_ROLLS_PER_MODULE;
  }
  if (opts.nameCol === null) warnings.push("No name column selected — only roll numbers will be imported.");
  return { students, warnings, rollColumnUsable };
}
