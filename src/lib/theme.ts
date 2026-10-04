"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export type Theme = "light" | "dark";
const listeners = new Set<() => void>();

function current(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.classList.toggle("dark", t === "dark");
  root.style.colorScheme = t;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  meta?.setAttribute("content", t === "dark" ? "#070C1A" : "#F8FAFC");
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* storage blocked — theme still applies for this visit */
  }
  window.setTimeout(() => root.classList.remove("theme-transition"), 250);
  listeners.forEach((l) => l());
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
    () => "light" as Theme,
  );
  return [theme, setTheme];
}
