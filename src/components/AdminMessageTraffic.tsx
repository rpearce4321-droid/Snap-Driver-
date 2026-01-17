// src/components/AdminMessageTraffic.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Conversation, ChatMessage } from "../lib/messages";
import {
  getMessagesForConversation,
  getConversationsForSeeker,
} from "../lib/messages";
import { getSeekers, getRetainers } from "../lib/data";

// Derive types from data helpers
type Seeker = ReturnType<typeof getSeekers>[number];
type Retainer = ReturnType<typeof getRetainers>[number];

const AdminMessageTraffic: React.FC = () => {
  const [seekers, setSeekers] = useState<Seeker[]>([]);
  const [retainers, setRetainers] = useState<Retainer[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] =
    useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  // Load seekers, retainers, and aggregate all conversations on mount
  useEffect(() => {
    const allSeekers = getSeekers();
    const allRetainers = getRetainers();
    setSeekers(allSeekers);
    setRetainers(allRetainers);

    const convMap = new Map<string, Conversation>();

    // Aggregate conversations by scanning each Seeker's conversations
    for (const seeker of allSeekers) {
      const convs = getConversationsForSeeker(seeker.id);
      for (const c of convs) {
        if (!convMap.has(c.id)) {
          convMap.set(c.id, c);
        }
      }
    }

    const convs = Array.from(convMap.values()).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    setConversations(convs);

    if (convs.length > 0) {
      const first = convs[0];
      setSelectedConversationId(first.id);
      setMessages(getMessagesForConversation(first.id));
    }
  }, []);

  // Reload messages when selected conversation changes
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    const msgs = getMessagesForConversation(selectedConversationId);
    setMessages(msgs);
  }, [selectedConversationId]);

  // Manual refresh button re-aggregates from helpers (not raw LS)
  const handleRefresh = () => {
    const allSeekers = getSeekers();
    const convMap = new Map<string, Conversation>();

    for (const seeker of allSeekers) {
      const convs = getConversationsForSeeker(seeker.id);
      for (const c of convs) {
        if (!convMap.has(c.id)) {
          convMap.set(c.id, c);
        }
      }
    }

    const convs = Array.from(convMap.values()).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    setConversations(convs);

    if (convs.length === 0) {
      setSelectedConversationId(null);
      setMessages([]);
      return;
    }

    if (
      selectedConversationId &&
      convs.some((c) => c.id === selectedConversationId)
    ) {
      setMessages(getMessagesForConversation(selectedConversationId));
    } else {
      const first = convs[0];
      setSelectedConversationId(first.id);
      setMessages(getMessagesForConversation(first.id));
    }
  };

  const seekerById = useMemo(
    () => new Map<string, Seeker>(seekers.map((s) => [s.id, s])),
    [seekers]
  );

  const retainerById = useMemo(
    () => new Map<string, Retainer>(retainers.map((r) => [r.id, r])),
    [retainers]
  );

  // KPIs
  const totalConversations = conversations.length;

  const totalMessages = useMemo(
    () =>
      conversations.reduce(
        (sum, c) => sum + getMessagesForConversation(c.id).length,
        0
      ),
    [conversations]
  );

  const totalUnreadForSeekers = conversations.reduce(
    (sum, c) => sum + (c.seekerUnreadCount || 0),
    0
  );
  const totalUnreadForRetainers = conversations.reduce(
    (sum, c) => sum + (c.retainerUnreadCount || 0),
    0
  );

  // Filtering
  const normalizedSearch = search.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((c) => {
        if (showOnlyUnread) {
          if (
            (c.seekerUnreadCount || 0) === 0 &&
            (c.retainerUnreadCount || 0) === 0
          ) {
            return false;
          }
        }

        if (!normalizedSearch) return true;

        const seeker = seekerById.get(c.seekerId);
        const retainer = retainerById.get(c.retainerId);

        const seekerName = formatSeekerName(seeker);
        const retainerName = formatRetainerName(retainer);

        const haystack = [c.subject, seekerName, retainerName]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [
    conversations,
    normalizedSearch,
    showOnlyUnread,
    seekerById,
    retainerById,
  ]);

  const selectedConversation =
    filteredConversations.find((c) => c.id === selectedConversationId) ??
    filteredConversations[0];

  // Ensure selection stays valid as filters change
  useEffect(() => {
    if (!selectedConversation && filteredConversations.length > 0) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [selectedConversation, filteredConversations]);

  // Empty state
  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        <h3 className="text-lg font-semibold text-slate-50 mb-1">
          Message Traffic
        </h3>
        <p>
          No conversations have started yet. Once Seekers and Retainers use the
          messaging buttons in their portals, all traffic will appear here for
          monitoring.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 md:p-5 space-y-4">
      {/* Header + KPIs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">
            Message Traffic
          </h3>
          <p className="text-xs text-slate-400 max-w-xl">
            Central view of all Seeker/Retainer conversations. Filter by
            subject or participant and drill into any thread without leaving the
            Admin dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Conversations"
          value={totalConversations}
          helper="Subject threads between Seekers and Retainers."
        />
        <KpiCard
          label="Total Messages"
          value={totalMessages}
          helper="Sum of all messages across conversations."
        />
        <KpiCard
          label="Unread (Seekers)"
          value={totalUnreadForSeekers}
          helper="Messages waiting on Seekers."
          accent="emerald"
        />
        <KpiCard
          label="Unread (Retainers)"
          value={totalUnreadForRetainers}
          helper="Messages waiting on Retainers."
          accent="sky"
        />
      </div>

      {/* Filters + main layout */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Conversation list */}
        <div className="md:w-2/5 lg:w-1/3 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-col">
          <div className="px-3 pt-3 pb-2 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Conversations
              </div>
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

          <div className="flex-1 max-h-[340px] md:max-h-[420px] overflow-y-auto px-2 py-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="text-xs text-slate-500 px-2 py-1.5">
                No conversations match your filters.
              </div>
            ) : (
              filteredConversations.map((c) => {
                const seeker = seekerById.get(c.seekerId);
                const retainer = retainerById.get(c.retainerId);
                const seekerName = formatSeekerName(seeker);
                const retainerName = formatRetainerName(retainer);

                const unreadTotal =
                  (c.seekerUnreadCount || 0) + (c.retainerUnreadCount || 0);

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
                          {seekerName} → {retainerName}
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

        {/* Conversation detail */}
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/80 flex flex-col">
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
                      {new Date(
                        selectedConversation.createdAt
                      ).toLocaleDateString()}
                    </div>
                    <div>
                      Last reply{" "}
                      {new Date(
                        selectedConversation.updatedAt
                      ).toLocaleTimeString()}
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

          <div className="flex-1 min-h-[260px] max-h-[420px] overflow-y-auto px-4 py-3 space-y-2">
            {selectedConversation ? (
              messages.length === 0 ? (
                <div className="text-xs text-slate-500">
                  No messages in this conversation yet.
                </div>
              ) : (
                messages.map((m) => {
                  const isSeeker = m.senderRole === "SEEKER";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${
                        isSeeker ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={[
                          "max-w-[85%] rounded-2xl px-3 py-1.5 text-[12px]",
                          isSeeker
                            ? "bg-slate-800 text-slate-50"
                            : "bg-emerald-500/25 text-emerald-50",
                        ].join(" ")}
                      >
                        <div className="whitespace-pre-wrap">{m.body}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400 text-right">
                          {m.senderRole === "SEEKER" ? "Seeker" : "Retainer"} •{" "}
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              <div className="text-xs text-slate-500">
                Select a conversation on the left to inspect the full message
                chain.
              </div>
            )}
          </div>

          {/* Footer helper */}
          <div className="px-4 py-2 border-t border-slate-800 text-[11px] text-slate-500">
            Admin has read-only visibility here. If moderation tools, flags, or
            export options are needed later, we can extend this panel without
            touching Seeker/Retainer flows.
          </div>
        </div>
      </div>
    </div>
  );
};

/* --------------------------- Small helpers -------------------------- */

const KpiCard: React.FC<{
  label: string;
  value: number;
  helper?: string;
  accent?: "emerald" | "sky";
}> = ({ label, value, helper, accent }) => {
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
      {helper && (
        <div className="text-[11px] text-slate-500 mt-1">{helper}</div>
      )}
    </div>
  );
};

function formatSeekerName(s?: Seeker): string {
  if (!s) return "Unknown Seeker";
  const full = `${(s as any).firstName ?? ""} ${
    (s as any).lastName ?? ""
  }`.trim();
  if (full) return full;
  return (s as any).name || "Seeker";
}

function formatRetainerName(r?: Retainer): string {
  if (!r) return "Unknown Retainer";
  return (
    (r as any).companyName ||
    (r as any).name ||
    (r as any).ceoName ||
    "Retainer"
  );
}

function renderParticipantsLine(
  c: Conversation,
  seekerById: Map<string, Seeker>,
  retainerById: Map<string, Retainer>
): string {
  const seeker = seekerById.get(c.seekerId);
  const retainer = retainerById.get(c.retainerId);
  const seekerName = formatSeekerName(seeker);
  const retainerName = formatRetainerName(retainer);
  return `${seekerName} \u2192 ${retainerName}`;
}

export default AdminMessageTraffic;

