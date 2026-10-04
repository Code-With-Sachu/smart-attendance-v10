"use client";

import * as React from "react";
import { Check, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

export const RollNumberButton = React.memo(function RollNumberButton({
  roll,
  label,
  name,
  absent,
  onToggle,
  tabIndex,
  onKeyDown,
}: {
  roll: number;
  label: string;
  /** Student name; undefined when the class has no names at all. */
  name?: string;
  absent: boolean;
  onToggle: (roll: number) => void;
  tabIndex: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>, roll: number) => void;
}) {
  const status = absent ? "Absent" : "Present";
  return (
    <button
      type="button"
      data-roll={roll}
      aria-pressed={absent}
      aria-label={`Roll ${label}${name ? ` ${name}` : ""} — ${status}`}
      title={`Roll ${label}${name ? ` · ${name}` : ""} — ${status}. ${absent ? "Tap to mark present" : "Tap to mark absent"}`}
      tabIndex={tabIndex}
      onClick={() => onToggle(roll)}
      onKeyDown={(e) => onKeyDown(e, roll)}
      className={cn(
        "relative flex select-none flex-col items-center justify-center rounded-xl border text-lg font-semibold tabular transition-[background-color,border-color,color,transform,box-shadow] duration-100 active:scale-95",
        name !== undefined ? "h-[88px] px-1.5" : "h-16 sm:h-[68px]",
        absent
          ? "border-absent-border bg-absent-bg text-absent-ink ring-1 ring-inset ring-absent-border"
          : "border-border bg-card text-ink shadow-sm hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <span className="leading-none">{label}</span>
      {name !== undefined && (
        <span className={cn("mt-1.5 line-clamp-2 w-full break-words text-center text-xs font-medium leading-tight", absent ? "text-absent-ink" : "text-ink-muted")}>
          {name || "—"}
        </span>
      )}
      <span className={cn("mt-1 text-[10px] font-semibold uppercase leading-none tracking-wide", absent ? "text-absent-strong" : "text-ink-subtle")}>
        {absent ? "Absent" : "Present"}
      </span>
      <span className="absolute right-1.5 top-1.5" aria-hidden>
        {absent ? <UserX className="size-3.5 text-absent-strong" /> : <Check className="size-3 text-slate-300" />}
      </span>
    </button>
  );
});
