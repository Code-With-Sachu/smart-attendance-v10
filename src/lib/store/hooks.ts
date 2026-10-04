"use client";

import { useEffect, useSyncExternalStore } from "react";
import { store } from "./store";
import type { AppData } from "@/lib/types";

/** Returns app data, or null while it is loading from storage. */
export function useAppData(): AppData | null {
  const data = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.hydrate(), []);
  return data;
}
