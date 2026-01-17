import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

/** Approve or reject a profile (seeker or retainer) */
export function useApproveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { type: "seeker" | "retainer"; id: string }) => {
      const r = await api.post("/admin/approve", vars);
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-kpis"] });
    },
  });
}

export function useRejectProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { type: "seeker" | "retainer"; id: string }) => {
      const r = await api.post("/admin/reject", vars);
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-kpis"] });
    },
  });
}


