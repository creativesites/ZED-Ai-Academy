"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getMyLearnerPreferences, saveMyLearnerPreferences } from "@/actions/learner-memory";
import { LITE_STORAGE_KEY, resolveLite, type ConnectionHints } from "@/lib/tutor/lite-mode";

// Lite (data saver) on or off, shared by every AI Teacher surface on the page. The saved choice lives in
// localStorage; without one, the network decides (see shouldDefaultToLite). Server render: off.

const listeners = new Set<() => void>();
// Fallback when storage is blocked (private mode): the choice still applies for this page view.
let memoryChoice: string | null = null;
// P1-07: the learner's account data-saver preference (learner_preferences), fetched once per page load
// and only when this device has no saved choice. undefined = not loaded; null = none / signed out.
let accountDataSaver: boolean | null | undefined;
let accountRequested = false;

function loadAccountPreference(): void {
  if (accountRequested) return;
  accountRequested = true;
  getMyLearnerPreferences()
    .then((prefs) => {
      accountDataSaver = prefs?.dataSaver ?? null;
      if (accountDataSaver !== null) for (const listener of listeners) listener();
    })
    .catch(() => {
      accountDataSaver = null;
    });
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(LITE_STORAGE_KEY) ?? memoryChoice;
  } catch {
    return memoryChoice;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (readStored() === null) loadAccountPreference();
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  const connection = (navigator as Navigator & { connection?: ConnectionHints }).connection;
  return resolveLite(readStored(), connection, accountDataSaver);
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
    // Best effort: remember the choice on the account so other devices start the same way.
    accountDataSaver = next;
    void saveMyLearnerPreferences({ dataSaver: next }).catch(() => undefined);
    for (const listener of listeners) listener();
  }, []);

  return [lite, choose];
}
