import type { ID } from "@/lib/types";

/** Where a file lives: the teacher's Profile, or a specific sub module. */
export type FileOwner = { kind: "profile" } | { kind: "sub"; subModuleId: ID };

export type FileKind = "table" | "text" | "document" | "pdf" | "image" | "other";

export interface FileSheet {
  name: string;
  rows: string[][];
}

/**
 * An uploaded file. The original bytes are kept (`blob`) for download/preview, and the
 * readable content is extracted once into `text` and/or `sheets` — that is what the user
 * edits and what the AI assistant reads.
 */
export interface StoredFile {
  id: ID;
  owner: FileOwner;
  name: string;
  /** Original file name at upload time. */
  originalName: string;
  mime: string;
  ext: string;
  size: number;
  kind: FileKind;
  /** Readable text (documents, PDFs, notes). Editable. */
  text: string;
  /** Tables (spreadsheets / CSV). Editable. */
  sheets?: FileSheet[];
  /** Free notes or a description the teacher adds (also read by the assistant). */
  notes: string;
  blob?: Blob;
  /** Set when content couldn't be extracted (e.g. scanned PDF). */
  extractWarning?: string;
  createdAt: string;
  updatedAt: string;
  editCount: number;
}

export type FileMeta = Omit<StoredFile, "blob">;

export const ownerKey = (o: FileOwner) => (o.kind === "profile" ? "profile" : `sub:${o.subModuleId}`);
export const sameOwner = (a: FileOwner, b: FileOwner) => ownerKey(a) === ownerKey(b);

export const KIND_LABEL: Record<FileKind, string> = {
  table: "Spreadsheet",
  text: "Text",
  document: "Document",
  pdf: "PDF",
  image: "Image",
  other: "File",
};
