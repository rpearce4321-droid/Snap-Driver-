import React from "react";
import { useAdminKpis } from "../../lib/queries";

export default function AdminKpiStrip() {
  const { data, isLoading, isError } = useAdminKpis();

  const Box: React.FC<{label:string; value:number|string}> = ({label, value}) => (
    <div style={{
      background:"#111", border:"1px solid #222", borderRadius:12, padding:16, minWidth:150
    }}>
      <div style={{fontSize:12, color:"#aaa"}}>{label}</div>
      <div style={{fontSize:22, fontWeight:700}}>{value}</div>
    </div>
  );

  if (isLoading) return <div style={{color:"#aaa"}}>Loading KPIs…</div>;
  if (isError || !data) return <div style={{color:"#e66"}}>Failed to load KPIs.</div>;

  const s = data.seekers;
  const r = data.retainers;

  return (
    <div style={{display:"grid", gap:8, gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))"}}>
      <Box label="Seekers • Approved"  value={s.approved} />
      <Box label="Seekers • Pending"   value={s.pending} />
      <Box label="Seekers • Rejected"  value={s.rejected} />
      <Box label="Seekers • Suspended" value={s.suspended} />

      <Box label="Retainers • Approved"  value={r.approved} />
      <Box label="Retainers • Pending"   value={r.pending} />
      <Box label="Retainers • Rejected"  value={r.rejected} />
      <Box label="Retainers • Suspended" value={r.suspended} />
    </div>
  );
}


