// src/lib/storage.ts

export type StoreEnvelope<T> = {
  schemaVersion: number;
  data: T;
};
let storeListener: ((key: string) => void) | null = null;

export function setStoreListener(listener: ((key: string) => void) | null): void {
  storeListener = listener;
}

function hasLocalStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    !!window.localStorage
  );
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isStoreEnvelope(value: unknown): value is StoreEnvelope<unknown> {
  if (!value || typeof value !== "object") return false;
  const v = value as any;
  return typeof v.schemaVersion === "number" && "data" in v;
}

export function readStoreData<T>(key: string): T | null {
  if (!hasLocalStorage()) return null;
  const parsed = safeParseJson(window.localStorage.getItem(key));
  if (parsed === null || parsed === undefined) return null;
  if (isStoreEnvelope(parsed)) return parsed.data as T;
  return parsed as T;
}

export function writeStore<T>(
  key: string,
  schemaVersion: number,
  data: T
): void {
  if (!hasLocalStorage()) return;
  const envelope: StoreEnvelope<T> = { schemaVersion, data };
  try {
    window.localStorage.setItem(key, JSON.stringify(envelope));
    if (storeListener) storeListener(key);
  } catch {
    // ignore quota/serialization errors
  }
}

export function removeStore(key: string): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(key);
    if (storeListener) storeListener(key);
  } catch {
    // ignore
  }
}


