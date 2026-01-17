import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRetainers, getSeekers } from "../lib/data";
import * as Messages from "../lib/messages";

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

type Props = {
  currentRetainer?: Retainer | null;
  seekers?: Seeker[];
};

const CURRENT_RETAINER_KEY = "snapdriver_current_retainer_id";

const retainerActiveSeekerKey = (retainerId: string) =>
  `snapdriver_retainer_active_seeker_${retainerId}`;
const retainerActiveConvKey = (retainerId: string) =>
  `snapdriver_retainer_active_conversation_${retainerId}`;

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

function safeGetConversationsForRetainer(retainerId: string): Conversation[] {
  try {
    const fn =
      (Messages as any).getConversationsForRetainer ||
      (Messages as any).getConversationsForUser ||
      (Messages as any).getConversations;
    if (typeof fn === "function") {
      const res = fn.length >= 2 ? fn(retainerId, "RETAINER") : fn(retainerId);
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
      return (res as Conversation) ?? null;
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

function formatSeekerName(s: Seeker): string {
  const ss: any = s as any;
  const full = `${ss.firstName ?? ""} ${ss.lastName ?? ""}`.trim();
  return full || ss.name || "Seeker";
}

const RetainerMessagingCenter: React.FC<Props> = ({ currentRetainer, seekers }) => {
  const [allRetainers] = useState<Retainer[]>(() => getRetainers());
  const [allSeekers] = useState<Seeker[]>(() => seekers ?? getSeekers());

  // Prefer prop currentRetainer; otherwise fall back to localStorage
  const retainerId = useMemo(() => {
    if (currentRetainer?.id) return currentRetainer.id;

    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(CURRENT_RETAINER_KEY);
    if (stored) return stored;

    const first = (allRetainers as any[]).find((r: any) => r.status !== "DELETED")?.id ?? null;
    if (first) window.localStorage.setItem(CURRENT_RETAINER_KEY, first);
    return first;
  }, [currentRetainer?.id, allRetainers]);

  const seekerById = useMemo(
    () => new Map<string, Seeker>((allSeekers as any[]).map((s: any) => [s.id, s])),
    [allSeekers]
  );

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeSeekerId, setActiveSeekerId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const navigate = useNavigate();

  const openFeedLink = (target: FeedLinkTarget) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("snapdriver_feed_jump", JSON.stringify({
        role: "RETAINER",
        kind: target.kind,
        id: target.id,
      }));
    }
    navigate("/retainers");
  };


  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const [seekerQuery, setSeekerQuery] = useState("");
  const [subjectQuery, setSubjectQuery] = useState("");

  const [newSubjectOpen, setNewSubjectOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const refreshConversations = () => {
    if (!retainerId) return;
    const convs = safeGetConversationsForRetainer(retainerId);
    setConversations(convs);
  };

  useEffect(() => {
    refreshConversations();
  }, [retainerId]);

  // restore selection on load
  useEffect(() => {
    if (!retainerId) {
      setConversations([]);
      setActiveSeekerId(null);
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    const convs = safeGetConversationsForRetainer(retainerId);
    setConversations(convs);

    if (convs.length === 0) {
      setActiveSeekerId(null);
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    let restoredSeeker: string | null = null;
    let restoredConv: string | null = null;

    if (typeof window !== "undefined") {
      restoredSeeker = window.localStorage.getItem(retainerActiveSeekerKey(retainerId));
      restoredConv = window.localStorage.getItem(retainerActiveConvKey(retainerId));
    }

    const hasSeeker = restoredSeeker && convs.some((c) => c.seekerId === restoredSeeker);
    const hasConv = restoredConv && convs.some((c) => c.id === restoredConv);

    const firstSeeker = convs[0].seekerId;

    setActiveSeekerId(hasSeeker ? restoredSeeker! : firstSeeker);

    if (hasConv) {
      setActiveConversationId(restoredConv!);
      safeMarkConversationRead(restoredConv!, "RETAINER");
      return;
    }

    const targetSeeker = hasSeeker ? restoredSeeker! : firstSeeker;
    const candidates = convs.filter((c) => c.seekerId === targetSeeker);
    setActiveConversationId(candidates[0]?.id ?? convs[0].id);
  }, [retainerId]);

  // persist selection
  useEffect(() => {
    if (!retainerId) return;
    if (typeof window === "undefined") return;

    if (activeSeekerId) window.localStorage.setItem(retainerActiveSeekerKey(retainerId), activeSeekerId);
    if (activeConversationId) window.localStorage.setItem(retainerActiveConvKey(retainerId), activeConversationId);
  }, [retainerId, activeSeekerId, activeConversationId]);

  // ensure selected conversation belongs to selected seeker
  useEffect(() => {
    if (!activeSeekerId) return;

    const convsForSeeker = conversations.filter((c) => c.seekerId === activeSeekerId);
    if (convsForSeeker.length === 0) {
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    if (!activeConversationId || !convsForSeeker.some((c) => c.id === activeConversationId)) {
      setActiveConversationId(convsForSeeker[0].id);
    }
  }, [activeSeekerId, conversations, activeConversationId]);

  // load messages
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    const msgs = safeGetMessagesForConversation(activeConversationId);
    setMessages(msgs);
    safeMarkConversationRead(activeConversationId, "RETAINER");
    refreshConversations();
  }, [activeConversationId]);

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  if (!retainerId) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        Select or create a Retainer profile first.
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 text-sm text-slate-300">
        No conversations yet. Start one from a Seeker card using the <span className="font-semibold text-emerald-300">Message</span> action.
      </div>
    );
  }

  const seekerIdsAll = Array.from(new Set(conversations.map((c) => c.seekerId)));

  const unreadForSeeker = (seekerId: string) =>
    conversations
      .filter((c) => c.seekerId === seekerId)
      .reduce((sum, c) => sum + (c.retainerUnreadCount || 0), 0);

  const seekerIdsFiltered = seekerIdsAll.filter((sid) => {
    const s = seekerById.get(sid) ?? ({} as any);
    const label = `${formatSeekerName(s as any)} ${(s as any).city ?? ""} ${(s as any).state ?? ""}`.toLowerCase();
    return label.includes(seekerQuery.trim().toLowerCase());
  });

  const convsForActiveSeekerAll = activeSeekerId
    ? conversations.filter((c) => c.seekerId === activeSeekerId)
    : [];

  const convsForActiveSeekerFiltered = convsForActiveSeekerAll.filter((c) =>
    String(c.subject || "").toLowerCase().includes(subjectQuery.trim().toLowerCase())
  );

  const activeConv = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId) ?? null
    : null;

  const handleSendReply = async () => {
    if (!activeConv || !replyBody.trim()) return;

    try {
      setSendingReply(true);
      const msg = safeAddMessageToConversation({
        conversationId: activeConv.id,
        body: replyBody,
        senderRole: "RETAINER",
      });

      if (msg) {
        setMessages((prev) => [...prev, msg]);
        setReplyBody("");
        refreshConversations();
      }
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreateNewSubject = (subject: string, body: string) => {
    if (!activeSeekerId || !retainerId) return;

    const conv = safeCreateConversationWithFirstMessage({
      seekerId: activeSeekerId,
      retainerId,
      subject,
      body,
      senderRole: "RETAINER",
    });

    refreshConversations();
    if (conv?.id) setActiveConversationId(conv.id);
    setNewSubjectOpen(false);
    setSubjectQuery("");
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/50">
        <h3 className="text-lg font-semibold text-slate-50">Messaging Center</h3>
        <p className="text-sm text-slate-300 mt-1">
          Left rail = Seekers. Middle rail = subjects. Right panel = message thread.
        </p>
      </div>

      <div className="grid grid-cols-12 min-h-[560px]">
        {/* Seekers rail */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/30">
          <div className="px-4 py-3 border-b border-slate-800 space-y-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Seekers</div>
              <div className="text-[11px] text-slate-500">{seekerIdsFiltered.length} shown</div>
            </div>

            <input
              className="w-full h-9 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={seekerQuery}
              onChange={(e) => setSeekerQuery(e.target.value)}
              placeholder="Search seekers…"
            />
          </div>

          <div className="p-2 space-y-2 max-h-[560px] md:max-h-none md:h-full overflow-y-auto">
            {seekerIdsFiltered.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">No seekers match your search.</div>
            ) : (
              seekerIdsFiltered.map((sid) => {
                const s = seekerById.get(sid) ?? ({} as any);
                const name = formatSeekerName(s as any);
                const city = (s as any).city ?? "—";
                const state = (s as any).state ?? "—";
                const unread = unreadForSeeker(sid);
                const isActive = sid === activeSeekerId;

                return (
                  <button
                    key={sid}
                    type="button"
                    onClick={() => setActiveSeekerId(sid)}
                    className={[
                      "w-full text-left rounded-2xl border px-3 py-2.5 transition flex items-center justify-between gap-3",
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/40"
                        : "bg-slate-950/40 border-slate-800 hover:bg-slate-900/60",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-50 truncate">{name || "Seeker"}</div>
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
        <div className="col-span-12 md:col-span-4 lg:col-span-4 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/20">
          <div className="px-4 py-3 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Subjects</div>
                <div className="text-[11px] text-slate-500">
                  {activeSeekerId ? `${convsForActiveSeekerFiltered.length} shown` : "Select a seeker"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setNewSubjectOpen(true)}
                disabled={!activeSeekerId}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + New
              </button>
            </div>

            <input
              className="w-full h-9 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              value={subjectQuery}
              onChange={(e) => setSubjectQuery(e.target.value)}
              placeholder="Search subjects…"
              disabled={!activeSeekerId}
            />
          </div>

          <div className="p-2 space-y-2 max-h-[560px] md:max-h-none md:h-full overflow-y-auto">
            {!activeSeekerId ? (
              <div className="p-4 text-sm text-slate-400">Select a Seeker on the left.</div>
            ) : convsForActiveSeekerFiltered.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">No subjects match your search.</div>
            ) : (
              convsForActiveSeekerFiltered.map((c) => {
                const isActive = c.id === activeConversationId;
                const unread = c.retainerUnreadCount || 0;

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
                      <div className="text-sm font-semibold text-slate-50 truncate">{c.subject || "Untitled"}</div>
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
        <div className="col-span-12 md:col-span-4 lg:col-span-5 bg-slate-950/10">
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="text-xs uppercase tracking-wide text-slate-400">Thread</div>
            <div className="text-sm font-semibold text-slate-50 truncate">{activeConv?.subject || "Select a subject"}</div>
          </div>

          {!activeConv ? (
            <div className="p-5 text-sm text-slate-400">Select a subject in the middle rail.</div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-3 md:p-4 flex-1 overflow-y-auto space-y-2 min-h-[340px]">
                {messages.length === 0 ? (
                  <div className="text-[12px] text-slate-500">No messages yet in this subject.</div>
                ) : (
                  messages.map((m) => {
                    const isRetainer = m.senderRole === "RETAINER";
                    const feedTarget = parseFeedFlag((m as any).flag);
                    return (
                      <div key={m.id} className={`flex ${isRetainer ? "justify-end" : "justify-start"}`}>
                        <div
                          className={[
                            "max-w-[85%] rounded-2xl px-3 py-1.5 text-[12px]",
                            isRetainer ? "bg-emerald-500/20 text-emerald-50" : "bg-slate-800 text-slate-50",
                          ].join(" ")}
                        >
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

              <div className="border-t border-slate-800 p-3 md:p-4 space-y-2">
                <label className="text-[11px] font-medium text-slate-200">
                  Reply in &ldquo;{activeConv.subject || "Untitled"}&rdquo;
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[70px]"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write your reply…"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyBody.trim()}
                    className="px-4 py-1.5 rounded-full text-xs font-medium bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sendingReply ? "Sending…" : "Send reply"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewSubjectModal
        open={newSubjectOpen}
        seeker={activeSeekerId ? seekerById.get(activeSeekerId) : undefined}
        onClose={() => setNewSubjectOpen(false)}
        onCreate={(subject, body) => handleCreateNewSubject(subject, body)}
      />
    </div>
  );
};

const NewSubjectModal: React.FC<{
  open: boolean;
  seeker?: Seeker;
  onClose: () => void;
  onCreate: (subject: string, body: string) => void;
}> = ({ open, seeker, onClose, onCreate }) => {
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
            <div className="text-sm font-semibold text-slate-50">{seeker ? formatSeekerName(seeker) : "Selected Seeker"}</div>
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
              placeholder="Example: Contract / route coverage"
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
              Create subject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetainerMessagingCenter;

