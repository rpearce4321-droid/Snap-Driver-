// src/components/data/RetainerGrid.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useRetainers } from "../../lib/queries";

type Retainer = {
  id: string;
  companyName?: string;
  city?: string;
  state?: string;
  email?: string;
  status?: string;
};

type Props = {
  status?: string;
  take?: number;
};

export default function RetainerGrid({ status = "APPROVED", take = 9 }: Props) {
  const retainers = useRetainers({ status, take });

  if (retainers.isLoading) {
    return <div className="text-sm text-white/70">Loading retainers…</div>;
  }

  if (retainers.error) {
    return (
      <div className="text-sm text-red-400">
        Error loading retainers.
      </div>
    );
  }

  const items: Retainer[] = (retainers.data?.items ?? []) as Retainer[];

  if (!items.length) {
    return (
      <div className="text-sm text-white/60">
        No retainers found for this status.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((r) => (
        <Link
          key={r.id}
          to={`/retainers/${r.id}`}
          className="group block rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:ring-2 hover:ring-indigo-500 transition"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold">
              {r.companyName ?? "Unnamed Company"}
            </div>
            {r.status && (
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                {r.status}
              </span>
            )}
          </div>

          <div className="text-xs text-white/70">
            {r.city ?? "—"}, {r.state ?? "—"}
          </div>

          {r.email && (
            <div className="text-xs text-white/60 mt-1 truncate">
              {r.email}
            </div>
          )}

          <div className="mt-3 text-[11px] text-indigo-300 opacity-0 group-hover:opacity-100 transition">
            Click to open profile →
          </div>
        </Link>
      ))}
    </div>
  );
}

