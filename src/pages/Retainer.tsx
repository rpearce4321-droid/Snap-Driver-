import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SeekerGrid from "../components/data/SeekerGrid";

export default function Retainer() {
  const [qc] = useState(() => new QueryClient());

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#efefef",
    padding: 20
  };

  const h1: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 12
  };

  const panel: React.CSSProperties = {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 12,
    padding: 16
  };

  return (
    <QueryClientProvider client={qc}>
      <div style={wrap}>
        <div style={h1}>Retainer Dashboard</div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: "#aaa" }}>
            Below are approved <strong>Seekers</strong> available to match.
          </p>
        </div>
        <div style={panel}>
          <SeekerGrid status="APPROVED" take={9} />
        </div>
      </div>
    </QueryClientProvider>
  );
}


