"use client";

import { useEffect, useSyncExternalStore } from "react";
import { uid } from "@/lib/utils";
import { store as appStore } from "@/lib/store/store";
import { fileDb } from "./db";
import { extOf, extractFile, MAX_UPLOAD_BYTES } from "./extract";
import { ownerKey, type FileOwner, type FileSheet, type StoredFile } from "./types";

type Listener = () => void;
export type FileResult<T> = { ok: true; data: T } | { ok: false; error: string };

const MAX_FILES_PER_OWNER = 100;

/**
 * Reactive store for uploaded files (Profile + sub modules), persisted in IndexedDB.
 * The whole list (including extracted text) is held in memory so the UI and the
 * AI assistant can read it synchronously.
 */
class FilesStore {
  private files: StoredFile[] | null = null;
  private listeners = new Set<Listener>();
  private loading: Promise<void> | null = null;
  persistent = true;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.files;
  getServerSnapshot = () => null;
  private emit() {
    this.listeners.forEach((l) => l());
  }

  hydrate(): Promise<void> {
    if (this.files) return Promise.resolve();
    if (!this.loading) {
      this.loading = fileDb
        .all()
        .then((all) => {
          this.files = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        })
        .catch((err) => {
          console.warn("[files] IndexedDB unavailable — files will only last for this visit", err);
          this.persistent = false;
          this.files = [];
        })
        .finally(() => this.emit());
    }
    return this.loading;
  }

  get list(): StoredFile[] {
    return this.files ?? [];
  }

  byOwner(owner: FileOwner): StoredFile[] {
    const k = ownerKey(owner);
    return this.list.filter((f) => ownerKey(f.owner) === k);
  }

  get(id: string) {
    return this.list.find((f) => f.id === id);
  }

  private async save(f: StoredFile) {
    if (this.persistent) await fileDb.put(f);
    const exists = this.list.some((x) => x.id === f.id);
    this.files = exists ? this.list.map((x) => (x.id === f.id ? f : x)) : [f, ...this.list];
    this.emit();
  }

  /** Upload several files at once. Returns how many succeeded and the errors for the rest. */
  async upload(owner: FileOwner, input: FileList | File[]): Promise<{ added: StoredFile[]; errors: string[] }> {
    await this.hydrate();
    const files = Array.from(input);
    const added: StoredFile[] = [];
    const errors: string[] = [];
    let count = this.byOwner(owner).length;
    for (const file of files) {
      if (count >= MAX_FILES_PER_OWNER) {
        errors.push(`${file.name}: limit of ${MAX_FILES_PER_OWNER} files reached here.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        errors.push(`${file.name}: larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
        continue;
      }
      if (file.size === 0) {
        errors.push(`${file.name}: the file is empty.`);
        continue;
      }
      const ex = await extractFile(file);
      const now = new Date().toISOString();
      const f: StoredFile = {
        id: uid("file"),
        owner,
        name: file.name.slice(0, 120),
        originalName: file.name.slice(0, 120),
        mime: file.type || "application/octet-stream",
        ext: extOf(file.name),
        size: file.size,
        kind: ex.kind,
        text: ex.text,
        ...(ex.sheets ? { sheets: ex.sheets } : {}),
        notes: "",
        blob: file,
        ...(ex.warning ? { extractWarning: ex.warning } : {}),
        createdAt: now,
        updatedAt: now,
        editCount: 0,
      };
      try {
        await this.save(f);
        added.push(f);
        count++;
      } catch (err) {
        console.error(err);
        errors.push(`${file.name}: couldn’t be saved (storage full or blocked).`);
      }
    }
    if (added.length) appStore.log("Files uploaded", `${added.length} file(s) → ${owner.kind === "profile" ? "Profile" : "sub module"}`);
    return { added, errors };
  }

  async update(id: string, patch: { name?: string; text?: string; sheets?: FileSheet[]; notes?: string; owner?: FileOwner }): Promise<FileResult<StoredFile>> {
    const f = this.get(id);
    if (!f) return { ok: false, error: "This file no longer exists." };
    const name = patch.name !== undefined ? patch.name.trim().replace(/\s+/g, " ").slice(0, 120) : f.name;
    if (!name) return { ok: false, error: "File name can’t be empty." };
    const next: StoredFile = {
      ...f,
      ...patch,
      name,
      notes: (patch.notes ?? f.notes).slice(0, 5000),
      updatedAt: new Date().toISOString(),
      editCount: f.editCount + 1,
    };
    try {
      await this.save(next);
      appStore.log("File edited", name);
      return { ok: true, data: next };
    } catch {
      return { ok: false, error: "Couldn’t save the file. Your device storage may be full." };
    }
  }

  /** Replace a file's bytes (keeps name, notes and location). */
  async replace(id: string, file: File): Promise<FileResult<StoredFile>> {
    const f = this.get(id);
    if (!f) return { ok: false, error: "This file no longer exists." };
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "That file is too large." };
    const ex = await extractFile(file);
    const next: StoredFile = {
      ...f,
      originalName: file.name,
      mime: file.type || "application/octet-stream",
      ext: extOf(file.name),
      size: file.size,
      kind: ex.kind,
      text: ex.text,
      sheets: ex.sheets,
      blob: file,
      extractWarning: ex.warning,
      updatedAt: new Date().toISOString(),
      editCount: f.editCount + 1,
    };
    try {
      await this.save(next);
      return { ok: true, data: next };
    } catch {
      return { ok: false, error: "Couldn’t save the file." };
    }
  }

  async remove(id: string): Promise<void> {
    const f = this.get(id);
    if (this.persistent) await fileDb.delete(id);
    this.files = this.list.filter((x) => x.id !== id);
    this.emit();
    if (f) appStore.log("File deleted", f.name);
  }

  async removeMany(ids: string[]) {
    for (const id of ids) if (this.persistent) await fileDb.delete(id);
    const set = new Set(ids);
    this.files = this.list.filter((x) => !set.has(x.id));
    this.emit();
  }

  async clearAll() {
    if (this.persistent) await fileDb.clear();
    this.files = [];
    this.emit();
  }

  /** Restore files from a backup (base64 blobs). */
  async importMany(items: StoredFile[]) {
    for (const f of items) await this.save(f);
  }

  totalBytes() {
    return this.list.reduce((s, f) => s + f.size, 0);
  }
}

export const filesStore = new FilesStore();

export function useFiles(): StoredFile[] | null {
  const files = useSyncExternalStore(filesStore.subscribe, filesStore.getSnapshot, filesStore.getServerSnapshot);
  useEffect(() => void filesStore.hydrate(), []);
  return files;
}
