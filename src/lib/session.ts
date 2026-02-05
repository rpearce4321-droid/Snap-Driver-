// src/lib/session.ts
import { readStoreData, removeStore, writeStore } from "./storage";

export type Role = "ADMIN" | "SEEKER" | "RETAINER";

export type Session = {
  role: Role;
  seekerId?: string;
  retainerId?: string;
  adminId?: string;\n  email?: string;
  createdAt?: string;
  updatedAt?: string;
};

const SESSION_KEY = "snapdriver_session_v1";
const PORTAL_CONTEXT_KEY = "snapdriver_portal_context_v1";

const SESSION_SCHEMA_VERSION = 1;

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  return readStoreData<Session>(SESSION_KEY);
}

export function setSession(session: Session): void {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString();
  const next: Session = {
    ...session,
    createdAt: session.createdAt ?? now,
    updatedAt: now,
  };
  writeStore(SESSION_KEY, SESSION_SCHEMA_VERSION, next);
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  removeStore(SESSION_KEY);
}

export function getSessionRole(): Role | null {
  return getSession()?.role ?? null;
}

export function setPortalContext(role: Role): void {
  if (typeof window === "undefined") return;
  // Use sessionStorage so multiple tabs can be on different portals without
  // fighting over a single localStorage value.
  window.sessionStorage.setItem(PORTAL_CONTEXT_KEY, role);
}

export function getPortalContext(): Role | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PORTAL_CONTEXT_KEY);
  return raw === "ADMIN" || raw === "SEEKER" || raw === "RETAINER" ? raw : null;
}

export function clearPortalContext(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PORTAL_CONTEXT_KEY);
}

