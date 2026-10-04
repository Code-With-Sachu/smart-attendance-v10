"use client";

import { Check } from "lucide-react";
import { PRESET_COLORS } from "@/lib/colors";
import { cn, readableOn } from "@/lib/utils";

export function ColorPicker({ value, onChange, id }: { value: string; onChange: (c: string) => void; id: string }) {
  const isCustom = !PRESET_COLORS.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map((c) => {
        const selected = c.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Colour ${c}`}
            onClick={() => onChange(c)}
            className={cn("grid size-8 place-items-center rounded-full ring-offset-2 transition-transform hover:scale-110", selected && "ring-2 ring-ink/70")}
            style={{ backgroundColor: c }}
          >
            {selected && <Check className="size-4" style={{ color: readableOn(c) }} aria-hidden />}
          </button>
        );
      })}
      <label
        className={cn(
          "relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-slate-400 ring-offset-2 hover:scale-110",
          isCustom && "ring-2 ring-ink/70",
        )}
        style={isCustom ? { backgroundColor: value, borderStyle: "solid" } : { background: "conic-gradient(#ef4444,#eab308,#22c55e,#0ea5e9,#8b5cf6,#ef4444)" }}
        title="Custom colour"
      >
        <span className="sr-only">Custom colour</span>
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <span className="ml-1 font-mono text-xs text-ink-muted">{value.toUpperCase()}</span>
    </div>
  );
}
