// src/components/data/SeekerGrid.tsx
import { Link } from "react-router-dom";
import { useSeekers } from "../../lib/queries";

type Seeker = {
  id: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  email?: string;
  status?: string;
};

type Props = {
  status?: string;
  take?: number;
};

export default function SeekerGrid({ status = "APPROVED", take = 9 }: Props) {
  const seekers = useSeekers({ status, take });

  if (seekers.isLoading) {
    return <div className="text-sm text-white/70">Loading seekers…</div>;
  }

  if (seekers.error) {
    return (
      <div className="text-sm text-red-400">
        Error loading seekers.
      </div>
    );
  }

  const items: Seeker[] = (seekers.data?.items ?? []) as Seeker[];

  if (!items.length) {
    return (
      <div className="text-sm text-white/60">
        No seekers found for this status.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((s) => (
        <Link
          key={s.id}
          to={`/seekers/${s.id}`}
          className="group block rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover:ring-2 hover:ring-indigo-500 transition"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold">
              {(s.firstName ?? "").trim()} {(s.lastName ?? "").trim()}
            </div>
            {s.status && (
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                {s.status}
              </span>
            )}
          </div>

          <div className="text-xs text-white/70">
            {s.city ?? "—"}, {s.state ?? "—"}
          </div>

          {s.email && (
            <div className="text-xs text-white/60 mt-1 truncate">
              {s.email}
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

