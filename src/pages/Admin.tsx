import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminKpiStrip from "../components/data/AdminKpiStrip";
import PendingTable from "../components/admin/PendingTable";

function AdminInner() {
  useEffect(() => console.log("[Admin] mounted"), []);
  const wrap: React.CSSProperties = { minHeight:"100vh", background:"#0a0a0a", color:"#efefef", padding:16 };
  const banner: React.CSSProperties = { background:"#004b23", border:"1px solid #0a7a2a", padding:12, borderRadius:12, marginBottom:12 };

  return (
    <div style={wrap}>
      <div style={banner}>
        <div style={{fontWeight:800, fontSize:18}}>Admin • LIVE MODE</div>
        <div style={{opacity:.8, fontSize:12}}>KPI strip + Pending Approvals</div>
      </div>
      <AdminKpiStrip />
      <PendingTable />
    </div>
  );
}

export default function AdminPage() {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <AdminInner />
    </QueryClientProvider>
  );
}


