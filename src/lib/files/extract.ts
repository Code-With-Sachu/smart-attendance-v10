import { parseSpreadsheet } from "@/lib/roster/parse";
import type { FileKind, FileSheet } from "./types";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** Extracted text is capped so one huge document can't fill the browser's storage. */
const MAX_TEXT = 400_000;

export const FILE_ACCEPT = [
  ".xlsx", ".xls", ".xlsm", ".ods", ".csv", ".tsv",
  ".docx", ".pdf", ".txt", ".md", ".json", ".rtf", ".html", ".htm",
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".pptx", ".zip",
].join(",");

export interface Extracted {
  kind: FileKind;
  text: string;
  sheets?: FileSheet[];
  warning?: string;
}

export const extOf = (name: string) => (name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "");

export function kindFor(name: string, mime: string): FileKind {
  const e = extOf(name);
  if ([".xlsx", ".xls", ".xlsm", ".ods", ".csv", ".tsv"].includes(e)) return "table";
  if (e === ".pdf" || mime === "application/pdf") return "pdf";
  if (e === ".docx" || e === ".rtf" || e === ".html" || e === ".htm") return "document";
  if ([".txt", ".md", ".json"].includes(e) || mime.startsWith("text/")) return "text";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

const cap = (s: string) => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + "\n…[truncated]" : s);

/** Read a file's content in the browser. Never throws — returns a warning instead. */
export async function extractFile(file: File): Promise<Extracted> {
  const kind = kindFor(file.name, file.type);
  try {
    if (kind === "table") {
      const sheets = await parseSpreadsheet(await file.arrayBuffer());
      return { kind, text: "", sheets: sheets.map((s) => ({ name: s.name, rows: s.rows.slice(0, 5000) })) };
    }
    if (kind === "pdf") {
      const text = await pdfText(await file.arrayBuffer());
      return text.trim()
        ? { kind, text: cap(text) }
        : { kind, text: "", warning: "No selectable text found (scanned PDF?). You can type notes or the content yourself." };
    }
    if (kind === "document") {
      const e = extOf(file.name);
      if (e === ".docx") {
        const mammoth = await import("mammoth");
        const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        return { kind, text: cap(res.value.replace(/\n{3,}/g, "\n\n").trim()) };
      }
      const raw = await file.text();
      if (e === ".rtf") return { kind, text: cap(raw.replace(/\\par[d]?/g, "\n").replace(/\{\*?\\[^{}]+}|[{}]|\\[a-z]+-?\d* ?/gi, "").trim()) };
      const doc = new DOMParser().parseFromString(raw, "text/html");
      return { kind, text: cap((doc.body.innerText || doc.body.textContent || "").trim()) };
    }
    if (kind === "text") {
      let text = await file.text();
      if (extOf(file.name) === ".json") {
        try {
          text = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          /* keep raw */
        }
      }
      return { kind, text: cap(text) };
    }
    if (kind === "image") return { kind, text: "" };
    return { kind, text: "", warning: "This file type can be stored and downloaded, but its content can’t be read or edited here." };
  } catch (err) {
    console.warn("[files] extract failed", err);
    return { kind, text: "", warning: "The content of this file couldn’t be read. It is stored and can still be downloaded." };
  }
}

async function pdfText(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const out: string[] = [];
  const pages = Math.min(pdf.numPages, 80);
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as Array<{ str?: string; transform?: number[] }>).filter((i) => i.str && i.transform);
    items.sort((a, b) => b.transform![5]! - a.transform![5]! || a.transform![4]! - b.transform![4]!);
    const lines: string[] = [];
    let lastY: number | null = null;
    let cur = "";
    for (const it of items) {
      const y = it.transform![5]!;
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(cur.trim());
        cur = "";
      }
      cur += (cur && !cur.endsWith(" ") ? " " : "") + it.str;
      lastY = y;
    }
    if (cur.trim()) lines.push(cur.trim());
    out.push(`--- Page ${p} ---\n${lines.filter(Boolean).join("\n")}`);
    if (out.join("\n").length > MAX_TEXT) break;
  }
  const body = out.join("\n\n");
  return body.replace(/--- Page \d+ ---\n?/g, "").trim() ? body : "";
}

/** Sheets → CSV text (used by the assistant and for downloads). */
export function sheetToCsv(rows: string[][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map((c) => esc(c ?? "")).join(",")).join("\n");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
