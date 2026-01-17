import { useAdminKpis, useSeekers, useRetainers } from "../lib/queries";

export default function DebugPanel() {
  if (!import.meta.env.DEV) return null;

  const kpis = useAdminKpis();
  const seekers = useSeekers({ status: "APPROVED", take: 9 });
  const retainers = useRetainers({ status: "APPROVED", take: 9 });

  return (
    <div style={{
      position: "fixed", right: 12, bottom: 12, zIndex: 9999,
      background: "rgba(20,20,20,0.9)", color: "#fff",
      padding: "10px 12px", borderRadius: 10, fontSize: 12,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)"
    }}>
      <div style={{opacity:.9, fontWeight: 700, marginBottom: 6}}>API Debug</div>
      <div>KPIs: {kpis.isLoading ? "…" : JSON.stringify(kpis.data)}</div>
      <div>Seekers: {seekers.isLoading ? "…" : seekers.data?.items?.length ?? 0}</div>
      <div>Retainers: {retainers.isLoading ? "…" : retainers.data?.items?.length ?? 0}</div>
    </div>
  );
}


