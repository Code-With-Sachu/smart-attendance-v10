"use client";

import { Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={() => setTheme(dark ? "light" : "dark")}
        aria-label={label}
        aria-pressed={dark}
        className={cn("grid size-10 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink", className)}
      >
        {dark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
      </button>
    </Tooltip>
  );
}

/** Theme-aware segmented control (used in Profile). */
export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border bg-slate-50 p-1">
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => setTheme(t)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
            theme === t ? "bg-card text-ink shadow-sm" : "text-ink-muted hover:text-ink",
          )}
        >
          {t === "light" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
          {t === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}

export function ThemedToaster() {
  const [theme] = useTheme();
  return <Toaster theme={theme} position="top-center" richColors closeButton toastOptions={{ className: "font-sans" }} />;
}
