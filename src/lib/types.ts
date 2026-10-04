/**
 * Domain types. These mirror the MongoDB collections planned for Version 2:
 *   users, mainModules, subModules, attendanceRecords
 * Roll numbers are embedded in the sub module (small, bounded list).
 * Attendance records store an immutable snapshot of names + roll list, so history
 * never depends on the *current* module/roll configuration.
 */

export type ID = string;

export interface MainModule {
  id: ID;
  name: string;
  number: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

/** One student from an uploaded roster. `details` keeps the other columns of the file for future use. */
export interface Student {
  roll: number;
  name: string;
  details?: Record<string, string>;
}

export interface SubModule {
  id: ID;
  mainModuleId: ID;
  name: string;
  number: number;
  color: string;
  rollNumbers: number[];
  /** Students with names (from an uploaded file). Rolls always match `rollNumbers`. */
  students?: Student[];
  /** Where the current student list came from. */
  rosterSource?: { fileName: string; importedAt: string };
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: ID;
  mainModuleId: ID;
  subModuleId: ID;
  /** Names at the time of submission (immutable history). */
  mainModuleName: string;
  subModuleName: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Session/period number for that day — part of the duplicate-protection key. */
  session: number;
  /** When the attendance was taken (ISO datetime). */
  takenAt: string;
  rollNumbers: number[];
  absent: number[];
  present: number[];
  /** Roll → student name at the time of submission (absent when the class had no names). */
  names?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  editCount: number;
}

export interface Profile {
  name: string;
  subject: string;
  teacherId: string;
  photo: string | null;
}

export type WhatsAppSendMode = "both" | "absent" | "present";

export interface WhatsAppContact {
  id: ID;
  label: string;
  number: string;
  /** Which lists this contact receives. */
  send: WhatsAppSendMode;
}

/** A student details file uploaded from Profile, kept for reuse in any sub module. */
export interface StudentList {
  id: ID;
  name: string;
  fileName: string;
  importedAt: string;
  columns: string[];
  students: Student[];
}

export type MessageStyle = "professional" | "plain";

export interface Settings {
  onboarded: boolean;
  /** Shown at the top of shared reports (e.g. college / department name). */
  institutionName: string;
  /** Students below this attendance rate (0–100) are flagged. */
  lowThreshold: number;
  messageStyle: MessageStyle;
  /** Add each student's overall % next to their name in shared reports. */
  includePercentInMessage: boolean;
  assistantEnabled: boolean;
  assistantName: string;
  /** Read assistant replies aloud. */
  assistantVoiceReplies: boolean;
  /** BCP-47 language for voice input/output, e.g. en-IN, ml-IN, hi-IN. */
  assistantLang: string;
  /** @deprecated V1 single contact — migrated into `whatsappContacts`. */
  whatsappNumber: string;
  whatsappContacts: WhatsAppContact[];
  allowDuplicateSessions: boolean;
  sidebarCollapsed: boolean;
}

export interface AttendanceDraft {
  subModuleId: ID;
  absent: number[];
  date: string;
  session: number;
  startedAt: string;
  updatedAt: string;
  /** When editing an existing record. */
  editingRecordId?: ID;
}

export interface ActivityEntry {
  id: ID;
  at: string;
  action: string;
  detail?: string;
}

export interface AppData {
  version: 1;
  activity: ActivityEntry[];
  mainModules: MainModule[];
  subModules: SubModule[];
  records: AttendanceRecord[];
  studentLists: StudentList[];
  profile: Profile;
  settings: Settings;
}

export type ModuleInput = { name: string; number: number; color: string };
