import bcrypt from "bcryptjs";
import type { Env } from "./_db";

const SESSION_COOKIE = "sd_session";
const SESSION_DAYS = 14;
const MAGIC_LINK_HOURS = 24;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

export function makeSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function makeMagicToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function sessionCookie(token: string, secure = false) {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Expires=${expires.toUTCString()}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure = false) {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function getCookie(request: Request, name: string) {
  const header = request.headers.get("Cookie") || "";
  const cookies = header.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.slice(name.length + 1);
    }
  }
  return null;
}

export function originFromRequest(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin) return origin;
  const host = request.headers.get("Host");
  if (!host) return "";
  const proto = request.headers.get("X-Forwarded-Proto") || "https";
  return `${proto}://${host}`;
}

export async function createSession(env: Env, userId: string) {
  const token = makeSessionToken();
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.DB
    .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(id, userId, tokenHash, expiresAt)
    .run();
  return { token, expiresAt };
}

export async function loadSession(env: Env, token: string) {
  const tokenHash = await sha256(token);
  const row = await env.DB
    .prepare(
      "SELECT sessions.id, sessions.user_id, sessions.expires_at, sessions.revoked_at, users.email, users.role, users.status FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?"
    )
    .bind(tokenHash)
    .first<any>();
  if (!row) return null;
  if (row.revoked_at) return null;
  if (Date.parse(row.expires_at) < Date.now()) return null;
  return row;
}

export async function revokeSession(env: Env, token: string) {
  const tokenHash = await sha256(token);
  await env.DB
    .prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}

export async function createMagicLink(env: Env, userId: string, purpose: string) {
  const token = makeMagicToken();
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_HOURS * 60 * 60 * 1000).toISOString();
  await env.DB
    .prepare(
      "INSERT INTO magic_links (id, user_id, token_hash, purpose, expires_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, userId, tokenHash, purpose, expiresAt)
    .run();
  return { token, expiresAt };
}

export async function consumeMagicLink(env: Env, token: string, purpose: string) {
  const tokenHash = await sha256(token);
  const row = await env.DB
    .prepare(
      "SELECT id, user_id, expires_at, used_at FROM magic_links WHERE token_hash = ? AND purpose = ?"
    )
    .bind(tokenHash, purpose)
    .first<any>();
  if (!row) return null;
  if (row.used_at) return null;
  if (Date.parse(row.expires_at) < Date.now()) return null;

  await env.DB
    .prepare("UPDATE magic_links SET used_at = datetime('now') WHERE id = ?")
    .bind(row.id)
    .run();

  return { userId: row.user_id };
}
