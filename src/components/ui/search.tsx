"use client";

import * as React from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  size = "md",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className={cn("pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle", size === "lg" ? "size-5" : "size-4")} aria-hidden />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border border-border bg-card pr-10 text-ink shadow-sm transition-colors placeholder:text-ink-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden",
          size === "lg" ? "h-12 pl-11 text-base" : "h-10 pl-10 text-sm",
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function useDebounced<T>(value: T, delay = 120): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function matches(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}
