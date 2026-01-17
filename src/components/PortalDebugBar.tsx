// src/components/PortalDebugBar.tsx
import React, { useMemo, useState } from "react";
import {
  getSession,
  setPortalRole,
  setActorId,
  setRetainerUserRole,
  type PortalRole,
  type RetainerUserRole,
} from "../lib/session";

export default function PortalDebugBar() {
  const initial = useMemo(() => getSession(), []);
  const [role, setRole] = useState<PortalRole>(initial.role);
  const [actorId, setActor] = useState<string>(initial.actorId ?? "");
  const [retainerUserRole, setRRole] = useState<RetainerUserRole>(
    initial.retainerUserRole ?? "OWNER"
  );

  // Only show to Admins (so this doesn't become a loophole)
  if (initial.role !== "ADMIN") return null;

  return (
    <div className="fixed bottom-3 left-3 z-[999] rounded-2xl border border-slate-700 bg-slate-950/90 backdrop-blur px-3 py-2 text-xs text-slate-100 shadow-lg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400">Portal:</span>
        <select
          className="h-8 rounded-xl border border-slate-700 bg-slate-900 px-2"
          value={role}
          onChange={(e) => {
            const next = e.target.value as PortalRole;
            setRole(next);
            setPortalRole(next);
          }}
        >
          <option value="ADMIN">ADMIN</option>
          <option value="SEEKER">SEEKER</option>
          <option value="RETAINER">RETAINER</option>
        </select>

        <span className="text-slate-400">ActorId:</span>
        <input
          className="h-8 w-44 rounded-xl border border-slate-700 bg-slate-900 px-2"
          value={actorId}
          onChange={(e) => setActor(e.target.value)}
          placeholder="(optional)"
        />
        <button
          className="h-8 rounded-xl border border-slate-700 bg-slate-900 px-3 hover:bg-slate-800"
          onClick={() => setActorId(actorId.trim() ? actorId.trim() : null)}
          type="button"
        >
          Set
        </button>

        <span className="text-slate-400">RetainerRole:</span>
        <select
          className="h-8 rounded-xl border border-slate-700 bg-slate-900 px-2"
          value={retainerUserRole}
          onChange={(e) => {
            const next = e.target.value as RetainerUserRole;
            setRRole(next);
            setRetainerUserRole(next);
          }}
        >
          <option value="OWNER">OWNER</option>
          <option value="STAFF">STAFF</option>
        </select>
      </div>
    </div>
  );
}


