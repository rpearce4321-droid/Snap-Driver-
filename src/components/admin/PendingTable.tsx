import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useApproveProfile, useRejectProfile } from "../../lib/mutations";

export default function PendingTable() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-pending"],
    queryFn: async () => {
      const r = await api.get("/admin/pending");
      return r.data as { seekers: any[]; retainers: any[] };
    },
  });

  const approve = useApproveProfile();
  const reject  = useRejectProfile();

  if (isLoading) return <div style={{color:"#aaa"}}>Loading pending items…</div>;
  if (isError)   return <div style={{color:"#e66"}}>Failed to load pending items.</div>;
  const seekers = data?.seekers ?? [];
  const retainers = data?.retainers ?? [];

  return (
    <div style={{marginTop:16}}>
      <h2 style={{fontSize:18, fontWeight:700, marginBottom:8}}>Pending Approvals</h2>
      {[["Seekers",seekers,"seeker"],["Retainers",retainers,"retainer"]].map(([label,arr,type]) => (
        <div key={label as string} style={{marginBottom:20}}>
          <div style={{fontWeight:600, marginBottom:6}}>{label}</div>
          {(arr as any[]).length === 0 && <div style={{fontSize:13, color:"#999"}}>None pending.</div>}
          {(arr as any[]).length > 0 && (
            <table style={{width:"100%", borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#111", color:"#aaa"}}>
                  <th style={{textAlign:"left", padding:"6px 8px"}}>Name / Company</th>
                  <th style={{textAlign:"left", padding:"6px 8px"}}>City</th>
                  <th style={{textAlign:"left", padding:"6px 8px"}}>State</th>
                  <th style={{textAlign:"center", padding:"6px 8px"}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(arr as any[]).map((p:any) => (
                  <tr key={p.id} style={{borderBottom:"1px solid #222"}}>
                    <td style={{padding:"6px 8px"}}>{p.companyName || p.firstName + " " + p.lastName}</td>
                    <td style={{padding:"6px 8px"}}>{p.city ?? "-"}</td>
                    <td style={{padding:"6px 8px"}}>{p.state ?? "-"}</td>
                    <td style={{textAlign:"center", padding:"6px 8px"}}>
                      <button
                        onClick={()=>approve.mutate({type:type as any, id:p.id})}
                        style={{marginRight:8, padding:"4px 8px", borderRadius:6, background:"#144", color:"#fff", border:"1px solid #266"}}
                      >Approve</button>
                      <button
                        onClick={()=>reject.mutate({type:type as any, id:p.id})}
                        style={{padding:"4px 8px", borderRadius:6, background:"#411", color:"#fff", border:"1px solid #622"}}
                      >Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      <button
        onClick={()=>refetch()}
        style={{marginTop:8, padding:"6px 10px", borderRadius:8, background:"#222", color:"#eee", border:"1px solid #333"}}
      >
        Refresh
      </button>
    </div>
  );
}


