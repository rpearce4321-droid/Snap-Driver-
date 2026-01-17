import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:5175";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
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


