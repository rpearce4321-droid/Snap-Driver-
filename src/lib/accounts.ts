// src/lib/accounts.ts
//
// Local-only account credentials for demo signup/signin.

import { readStoreData, writeStore } from "./storage";

export type AccountRole = "SEEKER" | "RETAINER";

export type Account = {
  id: string;
  role: AccountRole;
  email: string;
  password: string;
  seekerId?: string;
  retainerId?: string;
  createdAt: string;
  updatedAt: string;
};

const ACCOUNTS_KEY = "snapdriver_accounts_v1";
const ACCOUNTS_SCHEMA_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rnd}`;
}

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function normalizeAccount(raw: any): Account | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id || !raw.email || !raw.password || !raw.role) return null;
  const role: AccountRole = raw.role === "RETAINER" ? "RETAINER" : "SEEKER";
  return {
    id: String(raw.id),
    role,
    email: normalizeEmail(raw.email),
    password: String(raw.password),
    seekerId: typeof raw.seekerId === "string" ? raw.seekerId : undefined,
    retainerId: typeof raw.retainerId === "string" ? raw.retainerId : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function loadAccounts(): Account[] {
  const parsed = readStoreData<unknown>(ACCOUNTS_KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[])
    .map(normalizeAccount)
    .filter((a): a is Account => a !== null);
}

function saveAccounts(list: Account[]) {
  writeStore(ACCOUNTS_KEY, ACCOUNTS_SCHEMA_VERSION, list);
}

export function getAccounts(): Account[] {
  return loadAccounts();
}

export function getAccountByEmail(email: string): Account | null {
  const needle = normalizeEmail(email);
  if (!needle) return null;
  return loadAccounts().find((a) => a.email === needle) ?? null;
}

export function createAccount(args: {
  role: AccountRole;
  email: string;
  password: string;
  seekerId?: string;
  retainerId?: string;
}): Account {
  const email = normalizeEmail(args.email);
  if (!email) throw new Error("Email is required.");
  if (!args.password) throw new Error("Password is required.");
  const existing = getAccountByEmail(email);
  if (existing) throw new Error("An account already exists for that email.");

  const ts = nowIso();
  const account: Account = {
    id: makeId("acct"),
    role: args.role === "RETAINER" ? "RETAINER" : "SEEKER",
    email,
    password: String(args.password),
    seekerId: args.seekerId,
    retainerId: args.retainerId,
    createdAt: ts,
    updatedAt: ts,
  };

  const all = loadAccounts();
  all.push(account);
  saveAccounts(all);
  return account;
}

export function authenticateAccount(args: {
  email: string;
  password: string;
  role: AccountRole;
}): Account {
  const email = normalizeEmail(args.email);
  const account = getAccountByEmail(email);
  if (!account) throw new Error("No account found for that email.");
  if (account.role !== args.role) throw new Error("Account role mismatch.");
  if (account.password !== String(args.password)) {
    throw new Error("Incorrect password.");
  }
  return account;
}

export function getAccountProfileId(account: Account): string | null {
  return account.role === "SEEKER"
    ? account.seekerId ?? null
    : account.retainerId ?? null;
}
