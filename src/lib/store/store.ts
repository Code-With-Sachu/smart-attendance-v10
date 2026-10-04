import type { AppData, AttendanceRecord, MainModule, ModuleInput, Profile, Settings, Student, StudentList, SubModule, WhatsAppContact } from "@/lib/types";
import { uid } from "@/lib/utils";
import { normalizeRolls, validateModuleInput, validateName, validateWhatsAppNumber, cleanStudentName, MAX_ROLLS_PER_MODULE } from "@/lib/validation";
import { DATA_STORAGE_KEY, PersistenceError, defaultData, normalizeData, readData, writeData } from "./persistence";

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

type Listener = () => void;

const MAX_ACTIVITY = 300;

/**
 * Client-side application store.
 * Every mutating action validates its input (as a server would), applies the change
 * immutably, persists it, and only then notifies subscribers. If persisting fails the
 * previous state is kept — the UI never shows a change that was not saved.
 */
class AttendanceStore {
  private data: AppData | null = null;
  private listeners = new Set<Listener>();

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = () => this.data;
  getServerSnapshot = () => null;

  hydrate() {
    if (this.data) return;
    this.data = readData();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === DATA_STORAGE_KEY) {
          this.data = readData();
          this.emit();
        }
      });
    }
    this.emit();
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private commit(next: AppData, activity?: { action: string; detail?: string }): Result<true> {
    if (activity) {
      const entry = { id: uid("log"), at: new Date().toISOString(), action: activity.action, ...(activity.detail ? { detail: activity.detail.slice(0, 200) } : {}) };
      next = { ...next, activity: [entry, ...(next.activity ?? [])].slice(0, MAX_ACTIVITY) };
    }
    try {
      writeData(next);
      this.data = next;
      this.emit();
      return ok(true);
    } catch (err) {
      return fail(err instanceof PersistenceError ? err.userMessage : "Something went wrong while saving. Please try again.");
    }
  }

  private get state(): AppData {
    if (!this.data) this.data = readData();
    return this.data;
  }

  // ---------------- Main modules ----------------

  createMainModule(input: { name: string; number: string; color: string }): Result<MainModule> {
    const v = validateModuleInput(input);
    if (!v.ok) return fail(Object.values(v.errors)[0]!);
    const now = new Date().toISOString();
    const mod: MainModule = { id: uid("mm"), ...v.value, createdAt: now, updatedAt: now };
    const r = this.commit({ ...this.state, mainModules: [...this.state.mainModules, mod] }, { action: "Main module created", detail: mod.name });
    return r.ok ? ok(mod) : r;
  }

  updateMainModule(id: string, input: { name: string; number: string; color: string }): Result<MainModule> {
    const v = validateModuleInput(input);
    if (!v.ok) return fail(Object.values(v.errors)[0]!);
    const existing = this.state.mainModules.find((m) => m.id === id);
    if (!existing) return fail("This module no longer exists.");
    const updated: MainModule = { ...existing, ...v.value, updatedAt: new Date().toISOString() };
    const r = this.commit({ ...this.state, mainModules: this.state.mainModules.map((m) => (m.id === id ? updated : m)) }, { action: "Main module edited", detail: updated.name });
    return r.ok ? ok(updated) : r;
  }

  duplicateMainModule(id: string): Result<MainModule> {
    const src = this.state.mainModules.find((m) => m.id === id);
    if (!src) return fail("This module no longer exists.");
    const now = new Date().toISOString();
    const maxNumber = Math.max(0, ...this.state.mainModules.map((m) => m.number));
    const copy: MainModule = { ...src, id: uid("mm"), name: `${src.name} (copy)`.slice(0, 60), number: maxNumber + 1, createdAt: now, updatedAt: now };
    const subs = this.state.subModules
      .filter((s) => s.mainModuleId === id)
      .map<SubModule>((s) => ({ ...s, id: uid("sm"), mainModuleId: copy.id, createdAt: now, updatedAt: now }));
    const r = this.commit({ ...this.state, mainModules: [...this.state.mainModules, copy], subModules: [...this.state.subModules, ...subs] }, { action: "Main module duplicated", detail: copy.name });
    return r.ok ? ok(copy) : r;
  }

  /** Removes the module and its sub modules. Attendance history is kept (it stores its own snapshot). */
  deleteMainModule(id: string): Result<true> {
    const name = this.state.mainModules.find((m) => m.id === id)?.name;
    return this.commit({
      ...this.state,
      mainModules: this.state.mainModules.filter((m) => m.id !== id),
      subModules: this.state.subModules.filter((s) => s.mainModuleId !== id),
    }, { action: "Main module deleted", detail: name });
  }

  // ---------------- Sub modules ----------------

  createSubModule(mainModuleId: string, input: { name: string; number: string; color: string }): Result<SubModule> {
    if (!this.state.mainModules.some((m) => m.id === mainModuleId)) return fail("Parent module not found.");
    const v = validateModuleInput(input);
    if (!v.ok) return fail(Object.values(v.errors)[0]!);
    const now = new Date().toISOString();
    const sub: SubModule = { id: uid("sm"), mainModuleId, ...v.value, rollNumbers: [], createdAt: now, updatedAt: now };
    const r = this.commit({ ...this.state, subModules: [...this.state.subModules, sub] }, { action: "Sub module created", detail: sub.name });
    return r.ok ? ok(sub) : r;
  }

  updateSubModule(id: string, input: { name: string; number: string; color: string }): Result<SubModule> {
    const v = validateModuleInput(input);
    if (!v.ok) return fail(Object.values(v.errors)[0]!);
    const existing = this.state.subModules.find((s) => s.id === id);
    if (!existing) return fail("This sub module no longer exists.");
    const updated: SubModule = { ...existing, ...v.value, updatedAt: new Date().toISOString() };
    const r = this.commit({ ...this.state, subModules: this.state.subModules.map((s) => (s.id === id ? updated : s)) });
    return r.ok ? ok(updated) : r;
  }

  deleteSubModule(id: string): Result<true> {
    const name = this.state.subModules.find((s) => s.id === id)?.name;
    return this.commit({ ...this.state, subModules: this.state.subModules.filter((s) => s.id !== id) }, { action: "Sub module deleted", detail: name });
  }

  setRollNumbers(id: string, rolls: number[]): Result<SubModule> {
    const existing = this.state.subModules.find((s) => s.id === id);
    if (!existing) return fail("This sub module no longer exists.");
    const clean = normalizeRolls(rolls);
    if (clean.length !== rolls.length && rolls.some((n) => !Number.isInteger(n) || n < 1))
      return fail("Roll numbers must be positive whole numbers.");
    if (clean.length > MAX_ROLLS_PER_MODULE) return fail(`A sub module can have at most ${MAX_ROLLS_PER_MODULE} roll numbers.`);
    const updated: SubModule = { ...existing, rollNumbers: clean, updatedAt: new Date().toISOString() };
    if (existing.students?.length) {
      const keep = new Set(clean);
      const byRoll = new Map(existing.students.map((st) => [st.roll, st]));
      updated.students = clean.filter((n) => keep.has(n)).map((n) => byRoll.get(n) ?? { roll: n, name: "" });
      if (!updated.students.some((st) => st.name)) {
        updated.students = undefined;
        updated.rosterSource = undefined;
      }
    }
    const r = this.commit({ ...this.state, subModules: this.state.subModules.map((s) => (s.id === id ? updated : s)) });
    return r.ok ? ok(updated) : r;
  }

  /** Replace the class list with students (roll + name) from an uploaded file. */
  setStudents(id: string, students: Student[], fileName: string): Result<SubModule> {
    const existing = this.state.subModules.find((s) => s.id === id);
    if (!existing) return fail("This sub module no longer exists.");
    const v = sanitizeStudents(students);
    if (!v.ok) return fail(v.error);
    const updated: SubModule = {
      ...existing,
      rollNumbers: v.data.map((st) => st.roll),
      students: v.data,
      rosterSource: { fileName: fileName.slice(0, 120), importedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    };
    const r = this.commit({ ...this.state, subModules: this.state.subModules.map((s) => (s.id === id ? updated : s)) });
    return r.ok ? ok(updated) : r;
  }

  /** Add one student (roll + optional name) or rename an existing one. */
  upsertStudent(id: string, roll: number, name: string): Result<SubModule> {
    const existing = this.state.subModules.find((s) => s.id === id);
    if (!existing) return fail("This sub module no longer exists.");
    const clean = cleanStudentName(name);
    const rolls = existing.rollNumbers.includes(roll) ? existing.rollNumbers : normalizeRolls([...existing.rollNumbers, roll]);
    if (rolls.length > MAX_ROLLS_PER_MODULE) return fail(`A sub module can have at most ${MAX_ROLLS_PER_MODULE} roll numbers.`);
    const byRoll = new Map((existing.students ?? []).map((st) => [st.roll, st]));
    byRoll.set(roll, { ...(byRoll.get(roll) ?? { roll }), roll, name: clean });
    const students = rolls.map((n) => byRoll.get(n) ?? { roll: n, name: "" });
    const hasNames = students.some((st) => st.name);
    const updated: SubModule = {
      ...existing,
      rollNumbers: rolls,
      students: hasNames ? students : undefined,
      rosterSource: hasNames ? existing.rosterSource : undefined,
      updatedAt: new Date().toISOString(),
    };
    const r = this.commit({ ...this.state, subModules: this.state.subModules.map((s) => (s.id === id ? updated : s)) });
    return r.ok ? ok(updated) : r;
  }

  // ---------------- Student lists (Profile uploads) ----------------

  saveStudentList(input: { name: string; fileName: string; columns: string[]; students: Student[] }): Result<StudentList> {
    const name = input.name.trim().replace(/\s+/g, " ").slice(0, 60) || input.fileName.slice(0, 60) || "Student list";
    const v = sanitizeStudents(input.students);
    if (!v.ok) return fail(v.error);
    const list: StudentList = {
      id: uid("sl"),
      name,
      fileName: input.fileName.slice(0, 120),
      importedAt: new Date().toISOString(),
      columns: input.columns.slice(0, 20).map((c) => c.slice(0, 40)),
      students: v.data,
    };
    const r = this.commit({ ...this.state, studentLists: [list, ...this.state.studentLists] }, { action: "Student list saved", detail: list.name });
    return r.ok ? ok(list) : r;
  }

  deleteStudentList(id: string): Result<true> {
    return this.commit({ ...this.state, studentLists: this.state.studentLists.filter((l) => l.id !== id) });
  }

  // ---------------- Attendance ----------------

  findDuplicate(subModuleId: string, date: string, session: number, excludeId?: string): AttendanceRecord | undefined {
    return this.state.records.find(
      (r) => r.subModuleId === subModuleId && r.date === date && r.session === session && r.id !== excludeId,
    );
  }

  nextFreeSession(subModuleId: string, date: string): number {
    const used = new Set(this.state.records.filter((r) => r.subModuleId === subModuleId && r.date === date).map((r) => r.session));
    let s = 1;
    while (used.has(s)) s++;
    return s;
  }

  submitAttendance(input: { subModuleId: string; date: string; session: number; takenAt: string; absent: number[] }): Result<AttendanceRecord> {
    const sub = this.state.subModules.find((s) => s.id === input.subModuleId);
    if (!sub) return fail("This sub module no longer exists.");
    const main = this.state.mainModules.find((m) => m.id === sub.mainModuleId);
    if (!main) return fail("The parent module no longer exists.");
    if (!sub.rollNumbers.length) return fail("Add roll numbers before taking attendance.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Choose a valid date.");
    if (!Number.isInteger(input.session) || input.session < 1) return fail("Session must be 1 or more.");
    if (!this.state.settings.allowDuplicateSessions && this.findDuplicate(sub.id, input.date, input.session))
      return fail("DUPLICATE");

    const rollSet = new Set(sub.rollNumbers);
    const absent = normalizeRolls(input.absent).filter((n) => rollSet.has(n));
    const absentSet = new Set(absent);
    const present = sub.rollNumbers.filter((n) => !absentSet.has(n));
    const now = new Date().toISOString();
    const names: Record<string, string> = {};
    for (const st of sub.students ?? []) if (st.name && rollSet.has(st.roll)) names[String(st.roll)] = st.name;
    const record: AttendanceRecord = {
      id: uid("att"),
      mainModuleId: main.id,
      subModuleId: sub.id,
      mainModuleName: main.name,
      subModuleName: sub.name,
      date: input.date,
      session: input.session,
      takenAt: input.takenAt,
      rollNumbers: [...sub.rollNumbers],
      absent,
      present,
      ...(Object.keys(names).length ? { names } : {}),
      createdAt: now,
      updatedAt: now,
      editCount: 0,
    };
    const r = this.commit({ ...this.state, records: [...this.state.records, record] }, { action: "Attendance submitted", detail: `${sub.name} · ${input.date} · ${present.length}/${sub.rollNumbers.length} present` });
    return r.ok ? ok(record) : r;
  }

  /** Edits the absent list of an existing record. The roll list snapshot is preserved. */
  updateAttendance(id: string, absentInput: number[]): Result<AttendanceRecord> {
    const existing = this.state.records.find((r) => r.id === id);
    if (!existing) return fail("This attendance record no longer exists.");
    const rollSet = new Set(existing.rollNumbers);
    const absent = normalizeRolls(absentInput).filter((n) => rollSet.has(n));
    const absentSet = new Set(absent);
    const updated: AttendanceRecord = {
      ...existing,
      absent,
      present: existing.rollNumbers.filter((n) => !absentSet.has(n)),
      updatedAt: new Date().toISOString(),
      editCount: existing.editCount + 1,
    };
    const r = this.commit({ ...this.state, records: this.state.records.map((x) => (x.id === id ? updated : x)) }, { action: "Attendance edited", detail: `${existing.subModuleName} · ${existing.date}` });
    return r.ok ? ok(updated) : r;
  }

  deleteAttendance(id: string): Result<true> {
    const rec = this.state.records.find((r) => r.id === id);
    return this.commit({ ...this.state, records: this.state.records.filter((r) => r.id !== id) }, { action: "Attendance deleted", detail: rec ? `${rec.subModuleName} · ${rec.date}` : undefined });
  }

  // ---------------- Profile & settings ----------------

  updateProfile(p: Profile): Result<Profile> {
    const name = p.name.trim();
    if (name) {
      const err = validateName(name);
      if (err) return fail(err);
    }
    const clean: Profile = {
      name,
      subject: p.subject.trim().slice(0, 60),
      teacherId: p.teacherId.trim().slice(0, 30),
      photo: p.photo && p.photo.startsWith("data:image/") ? p.photo : null,
    };
    const r = this.commit({ ...this.state, profile: clean }, { action: "Profile updated" });
    return r.ok ? ok(clean) : r;
  }

  updateSettings(patch: Partial<Settings>): Result<Settings> {
    if (patch.whatsappNumber !== undefined) {
      const err = validateWhatsAppNumber(patch.whatsappNumber);
      if (err) return fail(err);
      patch = { ...patch, whatsappNumber: patch.whatsappNumber.replace(/[\s()-]/g, "") };
    }
    const settings = { ...this.state.settings, ...patch };
    const r = this.commit({ ...this.state, settings });
    return r.ok ? ok(settings) : r;
  }

  /** Replace the WhatsApp contact list (Profile → WhatsApp sharing). */
  setWhatsAppContacts(contacts: WhatsAppContact[]): Result<WhatsAppContact[]> {
    if (contacts.length > 20) return fail("You can save up to 20 WhatsApp numbers.");
    const clean: WhatsAppContact[] = [];
    const seen = new Set<string>();
    for (const [i, c] of contacts.entries()) {
      const number = c.number.replace(/[\s()-]/g, "");
      if (!number) return fail(`Number ${i + 1} is empty.`);
      const err = validateWhatsAppNumber(number);
      if (err) return fail(`Number ${i + 1}: ${err}`);
      const key = number.replace(/\D/g, "");
      if (seen.has(key)) return fail(`${number} is listed twice.`);
      seen.add(key);
      clean.push({
        id: c.id || uid("wa"),
        label: c.label.trim().replace(/\s+/g, " ").slice(0, 40),
        number,
        send: c.send === "absent" || c.send === "present" ? c.send : "both",
      });
    }
    const settings: Settings = { ...this.state.settings, whatsappContacts: clean, whatsappNumber: "" };
    const r = this.commit({ ...this.state, settings }, { action: "WhatsApp numbers saved", detail: `${clean.length} number(s)` });
    return r.ok ? ok(clean) : r;
  }

  // ---------------- Admin ----------------

  /** Clamp and save the admin-level settings. */
  updateAdminSettings(patch: Partial<Pick<Settings, "institutionName" | "lowThreshold" | "messageStyle" | "includePercentInMessage" | "assistantEnabled" | "assistantName" | "assistantVoiceReplies" | "assistantLang">>): Result<Settings> {
    const p = { ...patch };
    if (p.institutionName !== undefined) p.institutionName = p.institutionName.trim().replace(/\s+/g, " ").slice(0, 80);
    if (p.assistantName !== undefined) p.assistantName = p.assistantName.trim().slice(0, 40) || "Attendance Assistant";
    if (p.lowThreshold !== undefined) {
      const n = Math.round(Number(p.lowThreshold));
      if (!Number.isFinite(n) || n < 1 || n > 100) return fail("Threshold must be between 1 and 100.");
      p.lowThreshold = n;
    }
    const settings = { ...this.state.settings, ...p };
    const r = this.commit({ ...this.state, settings }, { action: "Settings changed", detail: Object.keys(p).join(", ") });
    return r.ok ? ok(settings) : r;
  }

  deleteRecords(ids: string[]): Result<number> {
    const set = new Set(ids);
    const before = this.state.records.length;
    const records = this.state.records.filter((r) => !set.has(r.id));
    const r = this.commit({ ...this.state, records }, { action: "Records deleted (bulk)", detail: `${before - records.length} record(s)` });
    return r.ok ? ok(before - records.length) : r;
  }

  /** Replace everything with a backup (keeps the onboarding flag so the app stays usable). */
  restoreBackup(raw: unknown): Result<AppData> {
    if (!raw || typeof raw !== "object") return fail("That isn’t a Smart Attendance backup file.");
    const b = raw as Partial<AppData>;
    if (!Array.isArray(b.mainModules) || !Array.isArray(b.records)) return fail("That isn’t a Smart Attendance backup file.");
    const next = normalizeData(b);
    next.settings.onboarded = true;
    const r = this.commit(next, { action: "Backup restored", detail: `${next.records.length} records` });
    return r.ok ? ok(next) : r;
  }

  clearAllData(): Result<true> {
    const fresh = defaultData();
    fresh.settings = { ...fresh.settings, onboarded: true };
    return this.commit(fresh, { action: "All data cleared" });
  }

  clearActivity(): Result<true> {
    return this.commit({ ...this.state, activity: [] });
  }

  log(action: string, detail?: string) {
    this.commit({ ...this.state }, { action, detail });
  }
}

function sanitizeStudents(input: Student[]): Result<Student[]> {
  if (!input.length) return fail("The file has no students.");
  if (input.length > MAX_ROLLS_PER_MODULE) return fail(`A class can have at most ${MAX_ROLLS_PER_MODULE} students.`);
  const seen = new Set<number>();
  const out: Student[] = [];
  for (const st of input) {
    if (!Number.isInteger(st.roll) || st.roll < 1 || st.roll > 9999) return fail("Roll numbers must be whole numbers from 1 to 9999.");
    if (seen.has(st.roll)) return fail(`Roll ${st.roll} appears more than once.`);
    seen.add(st.roll);
    const details: Record<string, string> = {};
    for (const [k, v] of Object.entries(st.details ?? {}).slice(0, 15)) {
      const val = String(v).trim().slice(0, 80);
      if (val) details[k.slice(0, 40)] = val;
    }
    out.push({ roll: st.roll, name: cleanStudentName(st.name), ...(Object.keys(details).length ? { details } : {}) });
  }
  return ok(out.sort((a, b) => a.roll - b.roll));
}

export const store = new AttendanceStore();
export type { ModuleInput };
