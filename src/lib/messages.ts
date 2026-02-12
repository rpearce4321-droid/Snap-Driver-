// src/lib/messages.ts

import { readStoreData, writeStore } from "./storage";

export type SenderRole = "SEEKER" | "RETAINER" | "ADMIN";

export const ADMIN_THREAD_ID = "snap_admin";

export type Conversation = {
  id: string;
  seekerId: string;
  retainerId: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  seekerUnreadCount: number;
  retainerUnreadCount: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderRole: SenderRole;
  body: string;
  createdAt: string;
  flag?: string;
};

const CONV_KEY = "snapdriver_conversations_v1";
const MSG_KEY = "snapdriver_messages_v1";

const CONV_SCHEMA_VERSION = 1;
const MSG_SCHEMA_VERSION = 1;

// Legacy support (so you don't lose messages if older code used these)
const LEGACY_CONV_KEY = "snapdriver_conversations";
const LEGACY_MSG_KEY = "snapdriver_messages";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rnd}`;
}

function loadArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const parsed = readStoreData<unknown>(key);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function saveArray<T>(key: string, list: T[], schemaVersion: number) {
  if (typeof window === "undefined") return;
  writeStore(key, schemaVersion, list);
}

function migrateLegacyIfNeeded() {
  if (typeof window === "undefined") return;

  const currentConvs = loadArray<Conversation>(CONV_KEY);
  const currentMsgs = loadArray<ChatMessage>(MSG_KEY);

  if (currentConvs.length > 0 || currentMsgs.length > 0) return;

  const legacyConvs = loadArray<Conversation>(LEGACY_CONV_KEY);
  const legacyMsgs = loadArray<ChatMessage>(LEGACY_MSG_KEY);

  if (legacyConvs.length === 0 && legacyMsgs.length === 0) return;

  saveArray(CONV_KEY, legacyConvs, CONV_SCHEMA_VERSION);
  saveArray(MSG_KEY, legacyMsgs, MSG_SCHEMA_VERSION);
}

function getAllConversationsInternal(): Conversation[] {
  migrateLegacyIfNeeded();
  return loadArray<Conversation>(CONV_KEY);
}

function getAllMessagesInternal(): ChatMessage[] {
  migrateLegacyIfNeeded();
  return loadArray<ChatMessage>(MSG_KEY);
}

function setAllConversationsInternal(list: Conversation[]) {
  saveArray(CONV_KEY, list, CONV_SCHEMA_VERSION);
}

function setAllMessagesInternal(list: ChatMessage[]) {
  saveArray(MSG_KEY, list, MSG_SCHEMA_VERSION);
}

function sortByUpdatedDesc(a: Conversation, b: Conversation) {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function sortByCreatedAsc(a: ChatMessage, b: ChatMessage) {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

function preview(text: string) {
  const t = (text || "").trim();
  if (!t) return "";
  return t.length > 140 ? `${t.slice(0, 140)}...` : t;
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export function getAllConversations(): Conversation[] {
  return getAllConversationsInternal().slice().sort(sortByUpdatedDesc);
}

export function getAllMessages(): ChatMessage[] {
  return getAllMessagesInternal().slice().sort(sortByCreatedAsc);
}

export function getConversationsForRetainer(retainerId: string): Conversation[] {
  return getAllConversationsInternal()
    .filter((c) => c.retainerId === retainerId)
    .slice()
    .sort(sortByUpdatedDesc);
}

export function getConversationsForSeeker(seekerId: string): Conversation[] {
  return getAllConversationsInternal()
    .filter((c) => c.seekerId === seekerId)
    .slice()
    .sort(sortByUpdatedDesc);
}

export function getMessagesForConversation(conversationId: string): ChatMessage[] {
  return getAllMessagesInternal()
    .filter((m) => m.conversationId === conversationId)
    .slice()
    .sort(sortByCreatedAsc);
}

export function createConversationWithFirstMessage(args: {
  seekerId: string;
  retainerId: string;
  subject: string;
  body: string;
  senderRole: SenderRole;
}): { conversation: Conversation; message: ChatMessage } {
  const subject = (args.subject || "").trim();
  const body = (args.body || "").trim();
  if (!subject) throw new Error("subject is required");
  if (!body) throw new Error("body is required");

  const ts = nowIso();

  const conversation: Conversation = {
    id: makeId("conv"),
    seekerId: args.seekerId,
    retainerId: args.retainerId,
    subject,
    createdAt: ts,
    updatedAt: ts,
    lastMessageAt: ts,
    lastMessagePreview: preview(body),
    seekerUnreadCount: args.senderRole === "RETAINER" ? 1 : 0,
    retainerUnreadCount: args.senderRole === "SEEKER" ? 1 : 0,
  };

  const message: ChatMessage = {
    id: makeId("msg"),
    conversationId: conversation.id,
    senderRole: args.senderRole,
    body,
    createdAt: ts,
  };

  const convs = getAllConversationsInternal();
  convs.unshift(conversation);
  setAllConversationsInternal(convs);

  const msgs = getAllMessagesInternal();
  msgs.push(message);
  setAllMessagesInternal(msgs);

  return { conversation, message };
}

export function addMessageToConversation(args: {
  conversationId: string;
  body: string;
  senderRole: SenderRole;
}): ChatMessage {
  const body = (args.body || "").trim();
  if (!body) throw new Error("body is required");

  const ts = nowIso();

  const msg: ChatMessage = {
    id: makeId("msg"),
    conversationId: args.conversationId,
    senderRole: args.senderRole,
    body,
    createdAt: ts,
  };

  const msgs = getAllMessagesInternal();
  msgs.push(msg);
  setAllMessagesInternal(msgs);

  const convs = getAllConversationsInternal();
  const idx = convs.findIndex((c) => c.id === args.conversationId);
  if (idx >= 0) {
    const c = convs[idx];
    const next: Conversation = {
      ...c,
      updatedAt: ts,
      lastMessageAt: ts,
      lastMessagePreview: preview(body),
      seekerUnreadCount: c.seekerUnreadCount,
      retainerUnreadCount: c.retainerUnreadCount,
    };

    if (args.senderRole === "SEEKER") next.retainerUnreadCount = c.retainerUnreadCount + 1;
    if (args.senderRole === "RETAINER") next.seekerUnreadCount = c.seekerUnreadCount + 1;

    convs.splice(idx, 1);
    convs.unshift(next);
    setAllConversationsInternal(convs);
  }

  return msg;
}

export function markConversationRead(conversationId: string, role: SenderRole): void {
  const convs = getAllConversationsInternal();
  const idx = convs.findIndex((c) => c.id === conversationId);
  if (idx < 0) return;

  const c = convs[idx];
  const next: Conversation = {
    ...c,
    seekerUnreadCount: role === "SEEKER" ? 0 : c.seekerUnreadCount,
    retainerUnreadCount: role === "RETAINER" ? 0 : c.retainerUnreadCount,
  };

  convs[idx] = next;
  setAllConversationsInternal(convs);
}

export function setMessageFlag(messageId: string, flag: string): ChatMessage | null {
  if (!messageId) return null;

  const msgs = getAllMessagesInternal();
  const idx = msgs.findIndex((m) => m.id === messageId);
  if (idx < 0) return null;

  const m = msgs[idx] as any;
  const next: ChatMessage = {
    ...(m as ChatMessage),
    flag: (flag || "").trim() ? flag : undefined,
  };

  msgs[idx] = next as any;
  setAllMessagesInternal(msgs);
  return next;
}

export function deleteConversation(conversationId: string): void {
  const convs = getAllConversationsInternal().filter((c) => c.id !== conversationId);
  setAllConversationsInternal(convs);

  const msgs = getAllMessagesInternal().filter((m) => m.conversationId !== conversationId);
  setAllMessagesInternal(msgs);
}

