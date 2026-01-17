// src/components/AdminSubcontractorMessageTraffic.tsx
import { useEffect, useMemo, useState } from "react";
import { getSeekers, type Seeker, type Subcontractor } from "../lib/data";
import {
  getSubcontractorMessages,
  type SubcontractorMessage,
} from "../lib/subcontractorMessages";

type Thread = {
  key: string;
  seekerId: string;
  subcontractorId: string;
  seekerName: string;
  subcontractorName: string;
  subcontractorTitle?: string;
  lastAt?: string;
  lastPreview?: string;
  messages: SubcontractorMessage[];
};

export default function AdminSubcontractorMessageTraffic() {
  const [seekers, setSeekers] = useState<Seeker[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const rebuild = () => {
    const ss = getSeekers();
    setSeekers(ss);

    const next: Thread[] = [];
    for (const s of ss) {
      const subs: Subcontractor[] = (s.subcontractors ?? []).filter(Boolean) as any;
      for (const sub of subs) {
        const msgs = getSubcontractorMessages(s.id, sub.id);
        if (msgs.length === 0) continue;
        const last = msgs[msgs.length - 1];
        next.push({
          key: `${s.id}:${sub.id}`,
          seekerId: s.id,
          subcontractorId: sub.id,
          seekerName: formatSeekerName(s),
          subcontractorName: `${sub.firstName} ${sub.lastName}`.trim() || "Subcontractor",
          subcontractorTitle: sub.title,
          lastAt: last.createdAt,
          lastPreview: (last.body || "").slice(0, 80),
          messages: msgs,
        });
      }
    }

    next.sort((a, b) => Date.parse(b.lastAt || "0") - Date.parse(a.lastAt || "0"));
    setThreads(next);

    if (next.length === 0) {
      setSelectedKey(null);
      return;
    }

    const stillExists = selectedKey && next.some((t) => t.key === selectedKey);
    setSelectedKey(stillExists ? selectedKey : next[0].key);
  };

  useEffect(() => {
    rebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedSearch) return threads;
    return threads.filter((t) =>
      [t.seekerName, t.subcontractorName, t.subcontractorTitle ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [threads, normalizedSearch]);

  const selected = filtered.find((t) => t.key === selectedKey) ?? filtered[0];

  if (threads.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        <h3 className="text-lg font-semibold text-slate-50 mb-1">
          Subcontractor Messages
        </h3>
        <p>No subcontractor threads exist yet.</p>
      </div>
    );
  }

  return (
    <div className="h-full rounded-2xl bg-slate-900/80 border border-slate-800 p-4 md:p-5 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">
            Subcontractor Messages
          </h3>
          <p className="text-xs text-slate-400 max-w-xl">
            Internal threads between a master Seeker and each subcontractor.
          </p>
        </div>
        <button
          type="button"
          onClick={rebuild}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4">
        <div className="md:w-2/5 lg:w-1/3 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-col min-h-0">
          <div className="px-3 pt-3 pb-2 border-b border-slate-800 space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Threads
            </div>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Search by seeker or subcontractor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-slate-500 px-2 py-1.5">
                No threads match your search.
              </div>
            ) : (
              filtered.map((t) => {
                const isSelected = selectedKey === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedKey(t.key)}
                    className={[
                      "w-full text-left px-2.5 py-2 rounded-xl border text-xs transition",
                      isSelected
                        ? "bg-emerald-500/15 border-emerald-500/60"
                        : "bg-slate-900/80 border-slate-800 hover:bg-slate-900",
                    ].join(" ")}
                  >
                    <div className="font-semibold text-slate-50 truncate">
                      {t.seekerName}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {t.subcontractorName}
                      {t.subcontractorTitle ? ` · ${t.subcontractorTitle}` : ""}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500 truncate">
                      {t.lastPreview || ""}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-col min-h-0">
          <div className="px-4 pt-3 pb-2 border-b border-slate-800">
            {selected ? (
              <>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Thread detail
                </div>
                <div className="text-sm font-semibold text-slate-50 truncate">
                  {selected.seekerName} · {selected.subcontractorName}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400">Select a thread.</div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            {!selected ? (
              <div className="text-xs text-slate-500">Select a thread.</div>
            ) : selected.messages.length === 0 ? (
              <div className="text-xs text-slate-500">No messages yet.</div>
            ) : (
              selected.messages.map((m) => {
                const isMaster = m.sender === "MASTER";
                return (
                  <div
                    key={m.id}
                    className={`flex ${isMaster ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={[
                        "max-w-[92%] rounded-2xl px-3 py-2 text-[12px] border",
                        isMaster
                          ? "bg-emerald-500/15 text-emerald-50 border-emerald-500/20"
                          : "bg-slate-900/70 text-slate-50 border-slate-800",
                      ].join(" ")}
                    >
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div className="mt-1 text-[10px] text-slate-400 text-right">
                        {m.sender === "MASTER" ? "Master" : "Subcontractor"} ·{" "}
                        {new Date(m.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="text-[11px] text-slate-500">
        Total Seekers: {seekers.length} · Threads: {threads.length}
      </div>
    </div>
  );
}

function formatSeekerName(s: Seeker): string {
  const full = `${(s as any).firstName ?? ""} ${(s as any).lastName ?? ""}`.trim();
  return full || (s as any).name || "Seeker";
}
