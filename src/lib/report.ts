import type { AppData, AttendanceRecord, WhatsAppSendMode } from "@/lib/types";
import type { MessageOptions } from "@/lib/whatsapp";
import { rollRatesForSub } from "@/lib/store/selectors";

/** Message options from the user's settings, with each student's overall % as of this record. */
export function messageOptionsFor(d: AppData, r: AttendanceRecord, mode: WhatsAppSendMode = "both", ratesOverride?: Record<number, number | null>): MessageOptions {
  const s = d.settings;
  return {
    teacherName: d.profile.name,
    teacherSubject: d.profile.subject,
    institution: s.institutionName,
    style: s.messageStyle,
    mode,
    lowThreshold: s.lowThreshold,
    rates: s.includePercentInMessage ? ratesOverride ?? rollRatesForSub(d, r.subModuleId, { upTo: r }) : undefined,
  };
}

export function downloadText(content: string, fileName: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([type.startsWith("text/csv") ? "﻿" + content : content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export const safeFileName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "report";
