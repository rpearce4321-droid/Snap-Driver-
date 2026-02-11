import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

export async function getSeekers(params?: { status?: string; take?: number; cursor?: string; query?: string }) {
  const r = await api.get<CursorPage<any>>("/seekers", { params });
  return r.data;
}

export async function getRetainers(params?: { status?: string; take?: number; cursor?: string; query?: string }) {
  const r = await api.get<CursorPage<any>>("/retainers", { params });
  return r.data;
}

export async function getAdminKpis() {
  const r = await api.get("/admin/kpis");
  return r.data as {
    seekers: { pending: number; approved: number; rejected: number; suspended: number };
    retainers: { pending: number; approved: number; rejected: number; suspended: number };
  };
}

export async function getAdminUsers(params?: { role?: string }) {
  const r = await api.get("/admin/users", { params });
  return r.data as {
    items: Array<{
      id: string;
      email: string;
      role: "ADMIN" | "SEEKER" | "RETAINER";
      status: string;
      statusNote?: string | null;
      statusUpdatedAt?: string | null;
      createdAt: string;
      updatedAt: string;
      passwordSet: boolean;
      source?: "server" | "local";
    }>;
  };
}

export async function setUserPassword(payload: { userId?: string; email?: string; password: string }) {
  const r = await api.post("/admin/users/password", payload);
  return r.data as { ok: boolean };
}

export async function setUserStatus(payload: { userId?: string; email?: string; status: string; note?: string }) {
  const r = await api.post("/admin/users/status", payload);
  return r.data as { ok: boolean };
}



export async function createSeedBatch(label?: string) {
  const r = await api.post('/seed/load', { label });
  return r.data as { ok: boolean; seedBatchId: string; label: string };
}

export async function listSeedBatches() {
  const r = await api.get('/seed/batches');
  return r.data as { items: Array<{ id: string; label: string; createdAt: string }> };
}

export async function importSeedData(payload: any) {
  const r = await api.post('/seed/import', payload);
  return r.data as { ok: boolean; inserted: number };
}

export async function purgeSeedBatch(payload: { batchId?: string; all?: boolean }) {
  const r = await api.post('/seed/purge', payload);
  return r.data as { ok: boolean; batchId: string | null };
}


export async function register(payload: { email: string; password: string; role: string }) {
  const r = await api.post('/auth/register', payload);
  return r.data as { ok: boolean; user: { id: string; email: string; role: string } };
}

export async function inviteUser(payload: { email: string; role: string }) {
  const r = await api.post('/auth/invite', payload);
  return r.data as { ok: boolean; magicLink: string; expiresAt: string };
}

export async function bootstrapAdmin(payload: { email: string; password: string; token: string }) {
  const r = await api.post(
    "/auth/bootstrap",
    { email: payload.email, password: payload.password },
    { headers: { "X-Bootstrap-Token": payload.token } }
  );
  return r.data as { ok: boolean; user: { id: string; email: string; role: string } };
}

export async function login(payload: { email: string; password: string }) {
  const r = await api.post('/auth/login', payload);
  return r.data as { ok: boolean; user: { id: string; email: string; role: string; status: string } };
}

export async function lookupProfile(payload: { email: string; role: string }) {
  const params = new URLSearchParams({ email: payload.email, role: payload.role });
  const r = await api.get(`/profile/lookup?${params.toString()}`);
  return r.data as { ok: boolean; id: string; status: string };
}

export async function logout() {
  const r = await api.post('/auth/logout');
  return r.data as { ok: boolean };
}

export async function getSessionMe() {
  const r = await api.get('/auth/me');
  return r.data as { ok: boolean; user: any | null };
}

export async function resetPassword(payload: { email: string }) {
  const r = await api.post('/auth/reset', payload);
  return r.data as { ok: boolean; magicLink: string; expiresAt: string };
}

export async function consumeReset(payload: { token: string; password: string }) {
  const r = await api.post('/auth/reset-consume', payload);
  return r.data as { ok: boolean };
}

export async function consumeInvite(payload: { token: string; password: string }) {
  const r = await api.post('/auth/consume', payload);
  return r.data as { ok: boolean };
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  const r = await api.post('/auth/change', payload);
  return r.data as { ok: boolean };
}

export async function wipeAllServerData(payload: { confirm: string }) {
  const r = await api.post('/seed/wipe', payload);
  return r.data as { ok: boolean };
}

export async function syncPull() {
  const r = await api.get('/sync/pull');
  return r.data;
}

export async function syncUpsert(payload: any) {
  const r = await api.post('/sync/upsert', payload);
  return r.data as { ok: boolean };
}



