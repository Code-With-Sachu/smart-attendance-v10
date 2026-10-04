/**
 * Shared validation. Pure functions so the same rules can run in the browser
 * (V1) and inside API routes / server actions (V2).
 */

export const MAX_NAME_LENGTH = 60;
export const MAX_ROLL = 9999;
export const MAX_ROLLS_PER_MODULE = 500;
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const NAME_PATTERN = /^[\p{L}\p{N} .,&()'\-/+#:]+$/u;

export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

/** Strictly parse a positive integer from user input. Rejects 0, negatives, decimals, text. */
export function parsePositiveInt(raw: string | number, max = MAX_ROLL): number | null {
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) return null;
  return n;
}

export function validateName(raw: string): string | undefined {
  const name = raw.trim();
  if (!name) return "Name is required.";
  if (name.length > MAX_NAME_LENGTH) return `Keep it under ${MAX_NAME_LENGTH} characters.`;
  if (!NAME_PATTERN.test(name)) return "Use letters, numbers, spaces and basic punctuation only.";
  return undefined;
}

export function validateModuleInput(input: { name: string; number: string; color: string }) {
  const errors: FieldErrors<"name" | "number" | "color"> = {};
  const nameError = validateName(input.name);
  if (nameError) errors.name = nameError;
  const number = parsePositiveInt(input.number);
  if (number === null) errors.number = "Enter a whole number of 1 or more.";
  if (!HEX_COLOR.test(input.color)) errors.color = "Pick a valid colour.";
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { name: input.name.trim().replace(/\s+/g, " "), number: number ?? 0, color: input.color.toUpperCase() },
  };
}

export function validateRollRange(fromRaw: string, toRaw: string) {
  const errors: FieldErrors<"from" | "to"> = {};
  const from = parsePositiveInt(fromRaw);
  const to = parsePositiveInt(toRaw);
  if (from === null) errors.from = "Enter a positive whole number (1, 2, 3…).";
  if (to === null) errors.to = "Enter a positive whole number (1, 2, 3…).";
  if (from !== null && to !== null) {
    if (to < from) errors.to = "‘To’ must be greater than or equal to ‘From’.";
    else if (to - from + 1 > MAX_ROLLS_PER_MODULE)
      errors.to = `A range can contain at most ${MAX_ROLLS_PER_MODULE} roll numbers.`;
  }
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, from: from ?? 0, to: to ?? 0 };
}

export function rangeToRolls(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function normalizeRolls(rolls: number[]): number[] {
  return Array.from(new Set(rolls.filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b);
}

/** Digits only, optional leading +; 8–15 digits (E.164). Empty is allowed (share to any chat). */
export function validateWhatsAppNumber(raw: string): string | undefined {
  const s = raw.replace(/[\s()-]/g, "");
  if (!s) return undefined;
  if (!/^\+?\d{8,15}$/.test(s)) return "Enter a number with country code, e.g. +91 98765 43210.";
  return undefined;
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function validateImageFile(file: File): string | undefined {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Use a JPG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 2 MB or smaller.";
  return undefined;
}

export const MAX_STUDENT_NAME = 80;

/** Trim, collapse whitespace, drop control characters and cap the length of a student name. */
export function cleanStudentName(raw: string): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_STUDENT_NAME);
}
