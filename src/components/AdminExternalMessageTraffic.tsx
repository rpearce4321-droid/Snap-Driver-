// src/components/AdminExternalMessageTraffic.tsx
import { useEffect, useMemo, useState } from "react";
import type { Conversation, ChatMessage } from "../lib/messages";
import {
  getAllConversations,
  getMessagesForConversation,
  setMessageFlag,
} from "../lib/messages";
import { getSeekers, getRetainers } from "../lib/data";

type Seeker = ReturnType<typeof getSeekers>[number];
type Retainer = ReturnType<typeof getRetainers>[number];

const FLAG_OPTIONS = ["", "FLAGGED", "REVIEWED", "HOLD"] as const;

export default function AdminExternalMessageTraffic() {
  const [seekers, setSeekers] = useState<Seeker[]>([]);
  const [retainers, setRetainers] = useState<Retainer[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  const seekerById = useMemo(
    () => new Map(seekers.map((s) => [s.id, s] as const)),
    [seekers]
  );
  const retainerById = useMemo(
    () => new Map(retainers.map((r) => [r.id, r] as const)),
    [retainers]
  );

  const refresh = () => {
    const nextSeekers = getSeekers();
    const nextRetainers = getRetainers();
    setSeekers(nextSeekers);
    setRetainers(nextRetainers);

    const nextConvs = getAllConversations();
    setConversations(nextConvs);

    if (nextConvs.length === 0) {
      setSelectedConversationId(null);
      setMessages([]);
      return;
    }

    const wanted =
      selectedConversationId &&
      nextConvs.some((c) => c.id === selectedConversationId)
        ? selectedConversationId
        : nextConvs[0].id;

    setSelectedConversationId(wanted);
    setMessages(getMessagesForConversation(wanted));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    setMessages(getMessagesForConversation(selectedConversationId));
  }, [selectedConversationId]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((c) => {
        if (showOnlyUnread) {
          const unread = (c.seekerUnreadCount || 0) + (c.retainerUnreadCount || 0);
          if (unread === 0) return false;
        }

        if (!normalizedSearch) return true;
        const seekerName = formatSeekerName(seekerById.get(c.seekerId));
        const retainerName = formatRetainerName(retainerById.get(c.retainerId));
        const haystack = [c.subject, seekerName, retainerName].join(" ").toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [conversations, showOnlyUnread, normalizedSearch, seekerById, retainerById]);

  const selectedConversation =
    filteredConversations.find((c) => c.id === selectedConversationId) ??
    filteredConversations[0];

  useEffect(() => {
    if (!selectedConversation) return;
    if (selectedConversationId !== selectedConversation.id) {
      setSelectedConversationId(selectedConversation.id);
    }
  }, [selectedConversation, selectedConversationId]);

  const totalUnreadSeekers = conversations.reduce((sum, c) => sum + (c.seekerUnreadCount || 0), 0);
  const totalUnreadRetainers = conversations.reduce((sum, c) => sum + (c.retainerUnreadCount || 0), 0);

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        <h3 className="text-lg font-semibold text-slate-50 mb-1">Message Traffic</h3>
        <p>
          No conversations have started yet. Once Seekers and Retainers use messaging in
          their portals, all traffic will appear here for monitoring.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full rounded-2xl bg-slate-900/80 border border-slate-800 p-4 md:p-5 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">Message Traffic</h3>
          <p className="text-xs text-slate-400 max-w-xl">
            Central view of all Seeker ↔ Retainer conversations. Filter by subject or
            participant and flag messages for follow-up.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <KpiCard label="Conversations" value={conversations.length} />
        <KpiCard label="Total Messages" value={conversations.reduce((sum, c) => sum + getMessagesForConversation(c.id).length, 0)} />
        <KpiCard label="Unread (Seekers)" value={totalUnreadSeekers} accent="emerald" />
        <KpiCard label="Unread (Retainers)" value={totalUnreadRetainers} accent="sky" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4">
        <div className="md:w-2/5 lg:w-1/3 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-col min-h-0">
          <div className="px-3 pt-3 pb-2 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">Conversations</div>
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                  checked={showOnlyUnread}
                  onChange={(e) => setShowOnlyUnread(e.target.checked)}
                />
                <span>Only unread</span>
              </label>
            </div>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Search by subject, Seeker, or Retainer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="text-xs text-slate-500 px-2 py-1.5">
                No conversations match your filters.
              </div>
            ) : (
              filteredConversations.map((c) => {
                const seekerName = formatSeekerName(seekerById.get(c.seekerId));
                const retainerName = formatRetainerName(retainerById.get(c.retainerId));
                const unreadTotal = (c.seekerUnreadCount || 0) + (c.retainerUnreadCount || 0);
                const isSelected = selectedConversationId === c.id;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedConversationId(c.id)}
                    className={[
                      "w-full text-left px-2.5 py-2 rounded-xl border text-xs transition",
                      isSelected
                        ? "bg-emerald-500/15 border-emerald-500/60"
                        : "bg-slate-900/80 border-slate-800 hover:bg-slate-900",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-50 truncate">
                          {c.subject || "No subject"}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {seekerName} ↔ {retainerName}
                        </div>
                      </div>
                      {unreadTotal > 0 && (
                        <div className="flex flex-col items-end gap-0.5">
                          {c.seekerUnreadCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-100">
                              S: {c.seekerUnreadCount}
                            </span>
                          )}
                          {c.retainerUnreadCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] text-sky-100">
                              R: {c.retainerUnreadCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      Updated{" "}
                      {new Date(c.updatedAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-col min-h-0">
          <div className="px-4 pt-3 pb-2 border-b border-slate-800">
            {selectedConversation ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Conversation detail
                    </div>
                    <div className="text-sm font-semibold text-slate-50 truncate">
                      {selectedConversation.subject || "No subject"}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <div>
                      Started{" "}
                      {new Date(selectedConversation.createdAt).toLocaleDateString()}
                    </div>
                    <div>
                      Last reply{" "}
                      {new Date(selectedConversation.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {renderParticipantsLine(
                    selectedConversation,
                    seekerById,
                    retainerById
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400">
                Select a conversation to see details.
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            {!selectedConversation ? (
              <div className="text-xs text-slate-500">
                Select a conversation on the left to inspect the full message chain.
              </div>
            ) : messages.length === 0 ? (
              <div className="text-xs text-slate-500">No messages yet.</div>
            ) : (
              messages.map((m) => {
                const isSeeker = m.senderRole === "SEEKER";
                const currentFlag = m.flag || "";
                const when = new Date(m.createdAt).toLocaleString();

                return (
                  <div
                    key={m.id}
                    className={`flex ${isSeeker ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={[
                        "max-w-[92%] rounded-2xl px-3 py-2 text-[12px] border",
                        isSeeker
                          ? "bg-slate-900/70 text-slate-50 border-slate-800"
                          : "bg-emerald-500/15 text-emerald-50 border-emerald-500/20",
                      ].join(" ")}
                    >
                      <div className="whitespace-pre-wrap">{m.body}</div>

                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] text-slate-400">
                          {m.senderRole === "SEEKER" ? "Seeker" : "Retainer"} · {when}
                        </div>

                        <div className="flex items-center gap-2">
                          {currentFlag && (
                            <span className="inline-flex items-center rounded-full border border-amber-400/60 px-1.5 py-0.5 text-[9px] text-amber-300">
                              {currentFlag}
                            </span>
                          )}
                          <select
                            className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-[10px] text-slate-200"
                            value={currentFlag}
                            onChange={(e) => {
                              const nextFlag = e.target.value;
                              setMessageFlag(m.id, nextFlag);
                              setMessages((prev) =>
                                prev.map((x) =>
                                  x.id === m.id ? { ...x, flag: nextFlag || undefined } : x
                                )
                              );
                            }}
                          >
                            {FLAG_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt ? opt : "No Flag"}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-slate-800 text-[11px] text-slate-500">
            Flags are stored on the message record for triage and moderation.
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "sky";
}) {
  const accentColor =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "sky"
      ? "text-sky-300"
      : "text-slate-50";

  return (
    <div className="rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
        {label}
      </div>
      <div className={`text-2xl font-semibold ${accentColor}`}>{value}</div>
    </div>
  );
}

function formatSeekerName(s?: Seeker): string {
  if (!s) return "Seeker";
  const full = `${(s as any).firstName ?? ""} ${(s as any).lastName ?? ""}`.trim();
  return full || (s as any).name || "Seeker";
}

function formatRetainerName(r?: Retainer): string {
  if (!r) return "Retainer";
  return (r as any).companyName || (r as any).name || (r as any).ceoName || "Retainer";
}

function renderParticipantsLine(
  c: Conversation,
  seekerById: Map<string, Seeker>,
  retainerById: Map<string, Retainer>
): string {
  const seeker = seekerById.get(c.seekerId);
  const retainer = retainerById.get(c.retainerId);
  return `${formatSeekerName(seeker)} ↔ ${formatRetainerName(retainer)}`;
}
