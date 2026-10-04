import type { AppData, AttendanceDraft } from "@/lib/types";

/**
 * Persistence adapter.
 * V1: browser localStorage. V2 swaps this for API routes backed by MongoDB —
 * the store's action signatures stay the same.
 */

const DATA_KEY = "smart-attendance:data:v1";
const DRAFT_PREFIX = "smart-attendance:draft:";

export const DATA_STORAGE_KEY = DATA_KEY;

export function defaultData(): AppData {
  return {
    version: 1,
    mainModules: [],
    subModules: [],
    records: [],
    studentLists: [],
    activity: [],
    profile: { name: "", subject: "", teacherId: "", photo: null },
    settings: {
      onboarded: false,
      institutionName: "",
      lowThreshold: 75,
      messageStyle: "professional",
      includePercentInMessage: true,
      assistantEnabled: true,
      assistantName: "Attendance Assistant",
      assistantVoiceReplies: false,
      assistantLang: "en-IN",
      whatsappNumber: "",
      whatsappContacts: [],
      allowDuplicateSessions: false,
      sidebarCollapsed: false,
    },
  };
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Normalise any parsed JSON (localStorage or a backup file) into valid AppData. */
export function normalizeData(parsed: Partial<AppData>): AppData {
  const base = defaultData();
  const settings = { ...base.settings, ...parsed.settings };
  if (!Array.isArray(settings.whatsappContacts)) settings.whatsappContacts = [];
  if (!settings.whatsappContacts.length && settings.whatsappNumber) {
    settings.whatsappContacts = [{ id: "wa_default", label: "Default contact", number: settings.whatsappNumber, send: "both" }];
  }
  return {
    ...base,
    ...parsed,
    profile: { ...base.profile, ...parsed.profile },
    settings,
    mainModules: parsed.mainModules ?? [],
    subModules: parsed.subModules ?? [],
    records: parsed.records ?? [],
    studentLists: parsed.studentLists ?? [],
    activity: parsed.activity ?? [],
    version: 1,
  };
}

export function readData(): AppData {
  const s = storage();
  if (!s) return defaultData();
  try {
    const raw = s.getItem(DATA_KEY);
    if (!raw) return defaultData();
    return normalizeData(JSON.parse(raw) as Partial<AppData>);
  } catch (err) {
    console.error("[persistence] Failed to read data", err);
    return defaultData();
  }
}

export class PersistenceError extends Error {
  constructor(public userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "PersistenceError";
    if (cause) console.error("[persistence]", cause);
  }
}

export function writeData(data: AppData): void {
  const s = storage();
  if (!s) throw new PersistenceError("Storage is not available in this browser.");
  try {
    s.setItem(DATA_KEY, JSON.stringify(data));
  } catch (err) {
    throw new PersistenceError("Your device storage is full or blocked. Nothing was saved.", err);
  }
}

// ---------- Drafts (auto-saved attendance selections) ----------

export function readDraft(key: string): AttendanceDraft | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(DRAFT_PREFIX + key);
    return raw ? (JSON.parse(raw) as AttendanceDraft) : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: AttendanceDraft): void {
  try {
    storage()?.setItem(DRAFT_PREFIX + key, JSON.stringify(draft));
  } catch (err) {
    console.warn("[persistence] Draft not saved", err);
  }
}

export function clearDraft(key: string): void {
  try {
    storage()?.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* ignore */
  }
}
