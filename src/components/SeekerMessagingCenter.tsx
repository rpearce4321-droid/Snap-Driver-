import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRetainers, getSeekers } from "../lib/data";
import * as Messages from "../lib/messages";
import {
  addSubcontractorMessage,
  getSubcontractorMessages,
  type SubcontractorMessage,
} from "../lib/subcontractorMessages";

// Minimal local types (keeps us resilient even if messages.ts doesn't export types)
type Conversation = {
  id: string;
  seekerId: string;
  retainerId: string;
  subject?: string;
  createdAt?: string;
  updatedAt?: string;
  lastMessageAt?: string;
  seekerUnreadCount?: number;
  retainerUnreadCount?: number;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  body: string;
  senderRole: "SEEKER" | "RETAINER" | "ADMIN";
  createdAt?: string;
  flag?: string;
};

type Retainer = ReturnType<typeof getRetainers>[number];
type Seeker = ReturnType<typeof getSeekers>[number];
type Subcontractor = NonNullable<Seeker["subcontractors"]>[number];

type Props = {
  currentSeeker?: Seeker | null;
  retainers?: Retainer[];
  subcontractors?: Subcontractor[];
};

const CURRENT_SEEKER_KEY = "snapdriver_current_seeker_id";

const seekerActiveRetainerKey = (seekerId: string) =>
  `snapdriver_seeker_active_retainer_${seekerId}`;
const seekerActiveConvKey = (seekerId: string) =>
  `snapdriver_seeker_active_conversation_${seekerId}`;
const seekerActiveSubKey = (seekerId: string) =>
  `snapdriver_seeker_active_subcontractor_${seekerId}`;

type FeedLinkTarget = { kind: "POST" | "ROUTE"; id: string };

const parseFeedFlag = (flag?: string): FeedLinkTarget | null => {
  if (!flag) return null;
  const parts = String(flag).split(":");
  if (parts.length < 3) return null;
  const [prefix, kind, ...rest] = parts;
  if (prefix !== "FEED") return null;
  const id = rest.join(":");
  if (!id) return null;
  if (kind !== "POST" && kind !== "ROUTE") return null;
  return { kind, id };
};

function safeGetConversationsForSeeker(seekerId: string): Conversation[] {
  try {
    const fn =
      (Messages as any).getConversationsForSeeker ||
      (Messages as any).getConversationsForUser ||
      (Messages as any).getConversations;
    if (typeof fn === "function") {
      const res = fn.length >= 2 ? fn(seekerId, "SEEKER") : fn(seekerId);
      return Array.isArray(res) ? (res as Conversation[]) : [];
    }
  } catch (err) {
    console.error(err);
  }
  return [];
}

function safeGetMessagesForConversation(conversationId: string): ChatMessage[] {
  try {
    const fn =
      (Messages as any).getMessagesForConversation ||
      (Messages as any).getMessages ||
      (Messages as any).listMessages;
    if (typeof fn === "function") {
      const res = fn(conversationId);
      return Array.isArray(res) ? (res as ChatMessage[]) : [];
    }
  } catch (err) {
    console.error(err);
  }
  return [];
}

function safeAddMessageToConversation(args: {
  conversationId: string;
  body: string;
  senderRole: "SEEKER" | "RETAINER" | "ADMIN";
}): ChatMessage | null {
  try {
    const fn =
      (Messages as any).addMessageToConversation ||
      (Messages as any).addMessage ||
      (Messages as any).createMessage;
    if (typeof fn === "function") {
      const res = fn(args);
      return (res as ChatMessage) ?? null;
    }
  } catch (err) {
    console.error(err);
  }
  return null;
}

const BROADCAST_SUBJECT_PREFIX = "[Broadcast]";

function safeCreateConversationWithFirstMessage(args: {
  seekerId: string;
  retainerId: string;
  subject: string;
  body: string;
  senderRole: "SEEKER" | "RETAINER" | "ADMIN";
}): Conversation | null {
  try {
    const fn =
      (Messages as any).createConversationWithFirstMessage ||
      (Messages as any).createConversation ||
      (Messages as any).startConversation;
    if (typeof fn === "function") {
      const res = fn(args);
      const conv: any = (res as any)?.conversation ?? res;
      return (conv as Conversation) ?? null;
    }
  } catch (err) {
    console.error(err);
  }
  return null;
}

function safeMarkConversationRead(conversationId: string, role: "SEEKER" | "RETAINER" | "ADMIN") {
  try {
    const fn =
      (Messages as any).markConversationRead ||
      (Messages as any).markRead ||
      (Messages as any).setConversationRead;
    if (typeof fn === "function") fn(conversationId, role);
  } catch {
    // non-fatal
  }
}

function formatRetainerName(r: Retainer): string {
  const rr: any = r as any;
  return rr.companyName || rr.name || rr.ceoName || "Retainer";
}

const SeekerMessagingCenter: React.FC<Props> = ({
  currentSeeker,
  retainers,
  subcontractors,
}) => {
  const [allSeekers] = useState<Seeker[]>(() => getSeekers());
  const [allRetainers] = useState<Retainer[]>(() => retainers ?? getRetainers());

  // If parent passes currentSeeker, we prefer it. Otherwise fall back to localStorage.
  const seekerId = useMemo(() => {
    if (currentSeeker?.id) return currentSeeker.id;

    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(CURRENT_SEEKER_KEY);
    if (stored) return stored;

    const first = (allSeekers as any[]).find((s: any) => s.status !== "DELETED")?.id ?? null;
    if (first) window.localStorage.setItem(CURRENT_SEEKER_KEY, first);
    return first;
  }, [currentSeeker?.id, allSeekers]);

  const retainerById = useMemo(
    () => new Map<string, Retainer>((allRetainers as any[]).map((r: any) => [r.id, r])),
    [allRetainers]
  );

  const availableSubs = useMemo(
    () => subcontractors ?? (currentSeeker?.subcontractors ?? []),
    [subcontractors, currentSeeker]
  );

  const [messageMode, setMessageMode] = useState<"retainers" | "subcontractors">("retainers");
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [subMessages, setSubMessages] = useState<SubcontractorMessage[]>([]);
  const [subBody, setSubBody] = useState("");
  const [subSending, setSubSending] = useState(false);
  const [subQuery, setSubQuery] = useState("");
  const subMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeRetainerId, setActiveRetainerId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const navigate = useNavigate();

  const openFeedLink = (target: FeedLinkTarget) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("snapdriver_feed_jump", JSON.stringify({
        role: "SEEKER",
        kind: target.kind,
        id: target.id,
      }));
    }
    navigate("/seekers");
  };


  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const [retainerQuery, setRetainerQuery] = useState("");
  const [subjectQuery, setSubjectQuery] = useState("");

  const [newSubjectOpen, setNewSubjectOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const refreshConversations = () => {
    if (!seekerId) return;
    const convs = safeGetConversationsForSeeker(seekerId);
    setConversations(convs);
  };

  useEffect(() => {
    refreshConversations();
  }, [seekerId]);

  // restore selection on load
  useEffect(() => {
    if (!seekerId) {
      setConversations([]);
      setActiveRetainerId(null);
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    const convs = safeGetConversationsForSeeker(seekerId);
    setConversations(convs);

    if (convs.length === 0) {
      setActiveRetainerId(null);
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    let restoredRetainer: string | null = null;
    let restoredConv: string | null = null;

    if (typeof window !== "undefined") {
      restoredRetainer = window.localStorage.getItem(seekerActiveRetainerKey(seekerId));
      restoredConv = window.localStorage.getItem(seekerActiveConvKey(seekerId));
    }

    const hasRetainer = restoredRetainer && convs.some((c) => c.retainerId === restoredRetainer);
    const hasConv = restoredConv && convs.some((c) => c.id === restoredConv);

    const firstRetainer = convs[0].retainerId;

    setActiveRetainerId(hasRetainer ? restoredRetainer! : firstRetainer);

    if (hasConv) {
      setActiveConversationId(restoredConv!);
      safeMarkConversationRead(restoredConv!, "SEEKER");
      return;
    }

    const targetRetainer = hasRetainer ? restoredRetainer! : firstRetainer;
    const candidates = convs.filter((c) => c.retainerId === targetRetainer);
    setActiveConversationId(candidates[0]?.id ?? convs[0].id);
  }, [seekerId]);

  // persist selection
  useEffect(() => {
    if (!seekerId) return;
    if (typeof window === "undefined") return;

    if (activeRetainerId) window.localStorage.setItem(seekerActiveRetainerKey(seekerId), activeRetainerId);
    if (activeConversationId) window.localStorage.setItem(seekerActiveConvKey(seekerId), activeConversationId);
  }, [seekerId, activeRetainerId, activeConversationId]);

  // ensure selected conversation belongs to selected retainer
  useEffect(() => {
    if (!activeRetainerId) return;

    const convsForRetainer = conversations.filter((c) => c.retainerId === activeRetainerId);
    if (convsForRetainer.length === 0) {
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    if (!activeConversationId || !convsForRetainer.some((c) => c.id === activeConversationId)) {
      setActiveConversationId(convsForRetainer[0].id);
    }
  }, [activeRetainerId, conversations, activeConversationId]);

  // load messages
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    const msgs = safeGetMessagesForConversation(activeConversationId);
    setMessages(msgs);
    safeMarkConversationRead(activeConversationId, "SEEKER");
    refreshConversations();
  }, [activeConversationId]);

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!seekerId) {
      setActiveSubId(null);
      setSubMessages([]);
      return;
    }
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(seekerActiveSubKey(seekerId))
        : null;
    const next =
      stored && availableSubs.some((s) => s.id === stored)
        ? stored
        : availableSubs[0]?.id ?? null;
    setActiveSubId(next);
  }, [seekerId, availableSubs]);

  useEffect(() => {
    if (!seekerId || typeof window === "undefined") return;
    if (activeSubId) {
      window.localStorage.setItem(seekerActiveSubKey(seekerId), activeSubId);
    } else {
      window.localStorage.removeItem(seekerActiveSubKey(seekerId));
    }
  }, [seekerId, activeSubId]);

  useEffect(() => {
    if (!seekerId || !activeSubId) {
      setSubMessages([]);
      return;
    }
    setSubMessages(getSubcontractorMessages(seekerId, activeSubId));
  }, [seekerId, activeSubId]);

  useEffect(() => {
    subMessagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [subMessages.length]);

  const handleSendReply = () => {
    if (!activeConversationId || !replyBody.trim()) return;
    try {
      setSendingReply(true);
      safeAddMessageToConversation({
        conversationId: activeConversationId,
        body: replyBody.trim(),
        senderRole: "SEEKER",
      });
      setReplyBody("");
      setMessages(safeGetMessagesForConversation(activeConversationId));
      refreshConversations();
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreateNewSubject = (subject: string, body: string) => {
    if (!seekerId || !activeRetainerId) return;
    const conv = safeCreateConversationWithFirstMessage({
      seekerId,
      retainerId: activeRetainerId,
      subject,
      body,
      senderRole: "SEEKER",
    });
    const convId = (conv as any)?.id;
    if (!convId) return;
    refreshConversations();
    setActiveConversationId(convId);
    setNewSubjectOpen(false);
  };

  const handleSendSubMessage = () => {
    if (!seekerId || !activeSubId || !subBody.trim()) return;
    try {
      setSubSending(true);
      addSubcontractorMessage({
        seekerId,
        subcontractorId: activeSubId,
        sender: "MASTER",
        body: subBody.trim(),
      });
      setSubBody("");
      setSubMessages(getSubcontractorMessages(seekerId, activeSubId));
    } finally {
      setSubSending(false);
    }
  };

  const activeSub = activeSubId
    ? availableSubs.find((s) => s.id === activeSubId) ?? null
    : null;

  const filteredSubs = (() => {
    const q = subQuery.trim().toLowerCase();
    if (!q) return availableSubs;
    return availableSubs.filter((s: any) => {
      const full = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
      const title = s.title ?? "";
      return `${full} ${title}`.toLowerCase().includes(q);
    });
  })();

  const retainerIds = Array.from(
    new Set(conversations.map((c) => c.retainerId).filter(Boolean))
  );

  const retainerIdsFiltered = (() => {
    const q = retainerQuery.trim().toLowerCase();
    if (!q) return retainerIds;
    return retainerIds.filter((rid) => {
      const r: any = retainerById.get(rid);
      const name = r ? formatRetainerName(r) : "";
      const city = r?.city ?? "";
      const state = r?.state ?? "";
      return `${name} ${city} ${state}`.toLowerCase().includes(q);
    });
  })();

  const unreadForRetainer = (rid: string): number => {
    let total = 0;
    for (const c of conversations) {
      if (c.retainerId !== rid) continue;
      const n = Number((c as any).seekerUnreadCount ?? (c as any).unreadCount ?? 0);
      if (!Number.isNaN(n)) total += n;
    }
    return total;
  };

  const convsForActiveRetainer = activeRetainerId
    ? conversations.filter((c) => c.retainerId === activeRetainerId)
    : [];

  const convsForActiveRetainerFiltered = (() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return convsForActiveRetainer;
    return convsForActiveRetainer.filter((c) =>
      (c.subject ?? "").toLowerCase().includes(q)
    );
  })();

  const activeConv = activeConversationId
    ? convsForActiveRetainer.find((c) => c.id === activeConversationId) ?? null
    : null;

  // guardrails
  const effectiveSeeker =
    currentSeeker ??
    (seekerId
      ? (allSeekers as any[]).find((s: any) => s.id === seekerId)
      : null);
  if (
    !seekerId ||
    !effectiveSeeker ||
    (effectiveSeeker as any).status === "DELETED"
  ) {
    return (
      <div className="h-full min-h-0 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <h3 className="text-lg font-semibold text-slate-50">
            Messaging Center
          </h3>
          <p className="text-sm text-slate-300 mt-1">
            Select or create a Seeker profile to start messaging.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/50">
        <h3 className="text-lg font-semibold text-slate-50">Messaging Center</h3>
        <p className="text-sm text-slate-300 mt-1">
          Left rail = Retainers. Middle rail = subjects. Right panel = message thread.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => setMessageMode("retainers")}
            className={[
              "px-3 py-1.5 rounded-full text-[11px] font-semibold border transition",
              messageMode === "retainers"
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            Retainer messages ({conversations.length})
          </button>
          <button
            type="button"
            onClick={() => setMessageMode("subcontractors")}
            className={[
              "px-3 py-1.5 rounded-full text-[11px] font-semibold border transition",
              messageMode === "subcontractors"
                ? "bg-sky-500/20 border-sky-500/50 text-sky-200"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
          >
            Subcontractor messages ({availableSubs.length})
          </button>
        </div>
      </div>

      {messageMode === "retainers" ? (
        conversations.length === 0 ? (
          <div className="p-6 text-sm text-slate-300">
            You haven&apos;t started any conversations yet. Use the{" "}
            <span className="font-semibold text-emerald-300">Message</span> button on a Retainer to start one.
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-12">
            {/* Retainers rail */}
            <div className="col-span-12 md:col-span-4 lg:col-span-3 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/30 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-slate-800 space-y-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Retainers</div>
                  <div className="text-[11px] text-slate-500">{retainerIdsFiltered.length} shown</div>
                </div>

                <input
                  className="w-full h-9 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={retainerQuery}
                  onChange={(e) => setRetainerQuery(e.target.value)}
                  placeholder="Search retainers."
                />
              </div>

              <div className="p-2 space-y-2 flex-1 min-h-0 overflow-y-auto">
                {retainerIdsFiltered.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No retainers match your search.</div>
                ) : (
                  retainerIdsFiltered.map((rid) => {
                    const r = retainerById.get(rid) ?? ({} as any);
                    const name = formatRetainerName(r as any);
                    const city = (r as any).city ?? "-";
                    const state = (r as any).state ?? "-";
                    const unread = unreadForRetainer(rid);
                    const isActive = rid === activeRetainerId;

                    return (
                      <button
                        key={rid}
                        type="button"
                        onClick={() => setActiveRetainerId(rid)}
                        className={[
                          "w-full text-left rounded-2xl border px-3 py-2.5 transition flex items-center justify-between gap-3",
                          isActive
                            ? "bg-emerald-500/10 border-emerald-500/40"
                            : "bg-slate-950/40 border-slate-800 hover:bg-slate-900/60",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-50 truncate">
                            {name || "Retainer"}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {city !== "-" || state !== "-" ? `${city}, ${state}` : "Location not set"}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {unread > 0 && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/60 px-2 py-0.5 text-[10px] text-emerald-100">
                              {unread}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Subjects rail */}
            <div className="col-span-12 md:col-span-4 lg:col-span-4 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/20 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Subjects</div>
                    <div className="text-[11px] text-slate-500">
                      {activeRetainerId ? `${convsForActiveRetainerFiltered.length} shown` : "Select a retainer"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewSubjectOpen(true)}
                    disabled={!activeRetainerId}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + New
                  </button>
                </div>

                <input
                  className="w-full h-9 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
                  value={subjectQuery}
                  onChange={(e) => setSubjectQuery(e.target.value)}
                  placeholder="Search subjects."
                  disabled={!activeRetainerId}
                />
              </div>

              <div className="p-2 space-y-2 flex-1 min-h-0 overflow-y-auto">
                {!activeRetainerId ? (
                  <div className="p-4 text-sm text-slate-400">Select a Retainer on the left.</div>
                ) : convsForActiveRetainerFiltered.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No subjects match your search.</div>
                ) : (
                  convsForActiveRetainerFiltered.map((c) => {
                    const isActive = c.id === activeConversationId;
                    const unread = c.seekerUnreadCount || 0;
                    const isBroadcast = (c.subject || "").startsWith(BROADCAST_SUBJECT_PREFIX);

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveConversationId(c.id)}
                        className={[
                          "w-full text-left rounded-2xl border px-3 py-2.5 transition flex items-center justify-between gap-3",
                          isActive
                            ? "bg-emerald-500/10 border-emerald-500/40"
                            : "bg-slate-950/40 border-slate-800 hover:bg-slate-900/60",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-50 truncate">
                            {c.subject || "Untitled"}
                          </div>
                          {isBroadcast && (
                            <div className="mt-1">
                              <span className="inline-flex items-center rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-200">
                                Broadcast
                              </span>
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400 truncate">
                            {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {unread > 0 && (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/60 px-2 py-0.5 text-[10px] text-emerald-100">
                              {unread}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Thread */}
            <div className="col-span-12 md:col-span-4 lg:col-span-5 bg-slate-950/10 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-slate-800">
                <div className="text-xs uppercase tracking-wide text-slate-400">Thread</div>
                <div className="text-sm font-semibold text-slate-50 truncate">{activeConv?.subject || "Select a subject"}</div>
              </div>

              {!activeConv ? (
                <div className="p-5 text-sm text-slate-400">Select a subject in the middle rail.</div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="p-3 md:p-4 flex-1 min-h-0 overflow-y-auto space-y-2">
                    {messages.length === 0 ? (
                      <div className="text-[12px] text-slate-500">No messages yet in this subject.</div>
                    ) : (
                      messages.map((m) => {
                        const isSeeker = m.senderRole === "SEEKER";
                        const isBroadcast = (m as any).flag === "BROADCAST";
                        const feedTarget = parseFeedFlag((m as any).flag);
                        return (
                          <div key={m.id} className={`flex ${isSeeker ? "justify-end" : "justify-start"}`}>
                            <div
                              className={[
                                "max-w-[85%] rounded-2xl px-3 py-1.5 text-[12px]",
                                isSeeker ? "bg-emerald-500/20 text-emerald-50" : "bg-slate-800 text-slate-50",
                              ].join(" ")}
                            >
                              {isBroadcast && (
                                <div className="mb-1">
                                  <span className="inline-flex items-center rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-200">
                                    Broadcast
                                  </span>
                                </div>
                              )}
                              {feedTarget && (
                                <div className="mb-1">
                                  <button
                                    type="button"
                                    onClick={() => openFeedLink(feedTarget)}
                                    className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100 hover:bg-emerald-500/20 transition"
                                  >
                                    {feedTarget.kind === "ROUTE" ? "View route" : "View ad"}
                                  </button>
                                </div>
                              )}
                              <div className="whitespace-pre-wrap">{m.body}</div>
                              <div className="mt-0.5 text-[10px] text-slate-400 text-right">
                                {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="shrink-0 border-t border-slate-800 p-3 md:p-4 space-y-2">
                    <label className="text-[11px] font-medium text-slate-200">
                      Reply in &ldquo;{activeConv.subject || "Untitled"}&rdquo;
                    </label>
                    <textarea
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[70px]"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write your reply."
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendingReply || !replyBody.trim()}
                        className="px-4 py-1.5 rounded-full text-xs font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {sendingReply ? "Sending." : "Send reply"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-12">
          <div className="col-span-12 md:col-span-4 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/30 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-slate-800 space-y-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Subcontractors</div>
                <div className="text-[11px] text-slate-500">{filteredSubs.length} shown</div>
              </div>
              <input
                className="w-full h-9 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={subQuery}
                onChange={(e) => setSubQuery(e.target.value)}
                placeholder="Search subcontractors."
              />
            </div>

            <div className="p-2 space-y-2 flex-1 min-h-0 overflow-y-auto">
              {filteredSubs.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">
                  No subcontractors found yet.
                </div>
              ) : (
                filteredSubs.map((sub) => {
                  const isActive = sub.id === activeSubId;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveSubId(sub.id)}
                      className={[
                        "w-full text-left rounded-2xl border px-3 py-2.5 transition",
                        isActive
                          ? "bg-sky-500/10 border-sky-500/40"
                          : "bg-slate-950/40 border-slate-800 hover:bg-slate-900/60",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-50 truncate">
                          {sub.firstName} {sub.lastName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {sub.title || "Subcontractor"}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="col-span-12 md:col-span-8 bg-slate-950/10 flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-slate-800">
              <div className="text-xs uppercase tracking-wide text-slate-400">Internal Thread</div>
              <div className="text-sm font-semibold text-slate-50 truncate">
                {activeSub
                  ? `${activeSub.firstName} ${activeSub.lastName}`
                  : "Select a subcontractor"}
              </div>
            </div>

            {!activeSub ? (
              <div className="p-5 text-sm text-slate-400">
                Select a subcontractor on the left to view messages.
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="p-3 md:p-4 flex-1 min-h-0 overflow-y-auto space-y-2">
                  {subMessages.length === 0 ? (
                    <div className="text-[12px] text-slate-500">
                      No messages yet for this subcontractor.
                    </div>
                  ) : (
                    subMessages.map((m) => {
                      const isMaster = m.sender === "MASTER";
                      return (
                        <div key={m.id} className={`flex ${isMaster ? "justify-end" : "justify-start"}`}>
                          <div
                            className={[
                              "max-w-[85%] rounded-2xl px-3 py-1.5 text-[12px]",
                              isMaster ? "bg-sky-500/20 text-sky-50" : "bg-slate-800 text-slate-50",
                            ].join(" ")}
                          >
                            <div className="whitespace-pre-wrap">{m.body}</div>
                            <div className="mt-0.5 text-[10px] text-slate-400 text-right">
                              {new Date(m.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={subMessagesEndRef} />
                </div>

                <div className="shrink-0 border-t border-slate-800 p-3 md:p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-[11px] font-medium text-slate-200">
                      Message {activeSub.firstName} {activeSub.lastName}
                    </label>
                    <button
                      type="button"
                      onClick={handleSendSubMessage}
                      disabled={subSending || !subBody.trim()}
                      className="px-4 py-1.5 rounded-full text-xs font-medium bg-sky-500/90 hover:bg-sky-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {subSending ? "Sending." : "Send update"}
                    </button>
                  </div>
                  <textarea
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[70px]"
                    value={subBody}
                    onChange={(e) => setSubBody(e.target.value)}
                    placeholder="Send an update to your subcontractor."
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <NewSubjectModal
        open={newSubjectOpen}
        retainer={activeRetainerId ? retainerById.get(activeRetainerId) : undefined}
        onClose={() => setNewSubjectOpen(false)}
        onCreate={(subject, body) => handleCreateNewSubject(subject, body)}
      />
    </div>
  );
};

const NewSubjectModal: React.FC<{
  open: boolean;
  retainer?: Retainer;
  onClose: () => void;
  onCreate: (subject: string, body: string) => void;
}> = ({ open, retainer, onClose, onCreate }) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubject("");
    setBody("");
    setError(null);
  }, [open]);

  if (!open) return null;

  const handleCreate = () => {
    setError(null);
    if (!subject.trim()) return setError("Please enter a subject.");
    if (!body.trim()) return setError("Please enter a first message.");
    onCreate(subject.trim(), body.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">New subject with</div>
            <div className="text-sm font-semibold text-slate-50">{retainer ? formatRetainerName(retainer) : "Selected Retainer"}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {error && (
            <div className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">Subject</label>
            <input
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Example: Schedule / route details"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">First message</label>
            <textarea
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[110px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the message that starts this subject…"
            />
          </div>

          <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreate}
                      className="px-4 py-2 rounded-full text-sm font-semibold bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
    </div>
  );
};

export default SeekerMessagingCenter;
