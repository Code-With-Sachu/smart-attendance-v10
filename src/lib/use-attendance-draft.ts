"use client";

import * as React from "react";
import { clearDraft, readDraft, writeDraft } from "@/lib/store/persistence";
import type { AttendanceDraft } from "@/lib/types";

/**
 * Drafts touched during this page load. Client-side navigation (grid → review → back)
 * keeps this set, so the draft is restored silently. A full reload clears it,
 * so the teacher is asked whether to restore.
 */
const liveDrafts = new Set<string>();

export function draftKey(subModuleId: string, editRecordId?: string | null) {
  return editRecordId ? `edit-${editRecordId}` : subModuleId;
}

export type DraftPhase = "loading" | "prompt" | "ready";

export function useAttendanceDraft(key: string, initial: () => AttendanceDraft) {
  const [draft, setDraft] = React.useState<AttendanceDraft | null>(null);
  const [phase, setPhase] = React.useState<DraftPhase>("loading");
  const [found, setFound] = React.useState<AttendanceDraft | null>(null);
  const initialRef = React.useRef(initial);
  initialRef.current = initial;

  React.useEffect(() => {
    const saved = readDraft(key);
    const fresh = initialRef.current();
    if (saved && liveDrafts.has(key)) {
      setDraft(saved);
      setPhase("ready");
    } else if (saved && saved.absent.join() !== fresh.absent.join()) {
      setFound(saved);
      setDraft(fresh);
      setPhase("prompt");
    } else {
      setDraft(fresh);
      setPhase("ready");
    }
  }, [key]);

  const update = React.useCallback(
    (patch: Partial<AttendanceDraft> | ((d: AttendanceDraft) => Partial<AttendanceDraft>)) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const p = typeof patch === "function" ? patch(prev) : patch;
        const next = { ...prev, ...p, updatedAt: new Date().toISOString() };
        writeDraft(key, next);
        liveDrafts.add(key);
        return next;
      });
    },
    [key],
  );

  const restore = React.useCallback(() => {
    if (found) {
      setDraft(found);
      liveDrafts.add(key);
    }
    setFound(null);
    setPhase("ready");
  }, [found, key]);

  const discard = React.useCallback(() => {
    clearDraft(key);
    liveDrafts.delete(key);
    setFound(null);
    setDraft(initialRef.current());
    setPhase("ready");
  }, [key]);

  /** Persist the current draft immediately (before navigating to review). */
  const flush = React.useCallback(() => {
    if (draft) {
      writeDraft(key, draft);
      liveDrafts.add(key);
    }
  }, [draft, key]);

  return { draft, phase, found, update, restore, discard, flush };
}

export function finishDraft(key: string) {
  clearDraft(key);
  liveDrafts.delete(key);
}

export function readLiveDraft(key: string): AttendanceDraft | null {
  return readDraft(key);
}
