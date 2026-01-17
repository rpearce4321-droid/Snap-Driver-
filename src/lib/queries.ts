import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

export function useAdminKpis() {
  return useQuery({
    queryKey: ["admin-kpis"],
    queryFn: async () => {
      const r = await api.get("/admin/kpis");
      return r.data as {
        seekers: { pending: number; approved: number; rejected: number; suspended: number };
        retainers: { pending: number; approved: number; rejected: number; suspended: number };
      };
    },
    retry: 0,
  });
}

type ListArgs = { status?: string; take?: number; cursor?: string; query?: string };

export function useSeekers(args: ListArgs = {}) {
  const { status = "APPROVED", take = 9, cursor, query } = args;
  return useQuery({
    queryKey: ["seekers", status, take, cursor, query],
    queryFn: async () => {
      const r = await api.get<CursorPage<any>>("/seekers", { params: { status, take, cursor, query } });
      return r.data;
    },
    keepPreviousData: true,
    retry: 0,
  });
}

export function useRetainers(args: ListArgs = {}) {
  const { status = "APPROVED", take = 9, cursor, query } = args;
  return useQuery({
    queryKey: ["retainers", status, take, cursor, query],
    queryFn: async () => {
      const r = await api.get<CursorPage<any>>("/retainers", { params: { status, take, cursor, query } });
      return r.data;
    },
    keepPreviousData: true,
    retry: 0,
  });
}


