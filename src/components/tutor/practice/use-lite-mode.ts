"use client";

import { useCallback, useSyncExternalStore } from "react";
import { LITE_STORAGE_KEY, resolveLite, type ConnectionHints } from "@/lib/tutor/lite-mode";

// Lite (data saver) on or off, shared by every AI Teacher surface on the page. The saved choice lives in
// localStorage; without one, the network decides (see shouldDefaultToLite). Server render: off.

const listeners = new Set<() => void>();
// Fallback when storage is blocked (private mode): the choice still applies for this page view.
let memoryChoice: string | null = null;

function readStored(): string | null {
  try {
    return window.localStorage.getItem(LITE_STORAGE_KEY) ?? memoryChoice;
  } catch {
    return memoryChoice;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  const connection = (navigator as Navigator & { connection?: ConnectionHints }).connection;
  return resolveLite(readStored(), connection);
}

function getServerSnapshot(): boolean {
  return false;
}

export function useLiteMode(): [boolean, (next: boolean) => void] {
  const lite = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const choose = useCallback((next: boolean) => {
    memoryChoice = next ? "1" : "0";
    try {
      window.localStorage.setItem(LITE_STORAGE_KEY, memoryChoice);
    } catch {
      // Not saved; memoryChoice keeps it for this page.
    }
    for (const listener of listeners) listener();
  }, []);

  return [lite, choose];
}
