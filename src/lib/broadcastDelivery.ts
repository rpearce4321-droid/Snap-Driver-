// src/lib/broadcastDelivery.ts
//
// Local-first helper to deliver Retainer broadcasts as mass direct messages (DMs)
// to ACTIVE linked Seekers.

import { getLinksForRetainer } from "./linking";
import { getAssignmentsForRetainer } from "./workUnits";
import {
  addMessageToConversation,
  createConversationWithFirstMessage,
  getAllConversations,
  setMessageFlag,
} from "./messages";

export const BROADCAST_SUBJECT_PREFIX = "[Broadcast]";
export const BROADCAST_MESSAGE_FLAG = "BROADCAST";

export function formatBroadcastConversationSubject(subject: string): string {
  const raw = String(subject || "").trim();
  if (!raw) return `${BROADCAST_SUBJECT_PREFIX} Update`;
  if (raw.startsWith(BROADCAST_SUBJECT_PREFIX)) return raw;
  return `${BROADCAST_SUBJECT_PREFIX} ${raw}`;
}

export function deliverRetainerBroadcastToLinkedSeekers(args: {
  retainerId: string;
  subject: string;
  body: string;
}): { delivered: number; failed: number } {
  const retainerId = String(args.retainerId || "").trim();
  const body = String(args.body || "").trim();
  const subject = formatBroadcastConversationSubject(args.subject);

  if (!retainerId) throw new Error("retainerId is required");
  if (!body) throw new Error("body is required");

  const activeAssignments = getAssignmentsForRetainer(retainerId).filter(
    (a) => a.status === "ACTIVE"
  );
  const activeSeekerIds = new Set(
    activeAssignments.map((a) => a.seekerId).filter(Boolean)
  );

  const seekerIds = Array.from(
    new Set(
      getLinksForRetainer(retainerId)
        .filter((l) => l.status === "ACTIVE")
        .filter((l) => activeSeekerIds.has(l.seekerId))
        .map((l) => l.seekerId)
        .filter(Boolean)
    )
  );

  const convs = getAllConversations();
  let delivered = 0;
  let failed = 0;

  for (const seekerId of seekerIds) {
    try {
      const existing =
        convs.find(
          (c) =>
            c.seekerId === seekerId &&
            c.retainerId === retainerId &&
            String(c.subject || "") === subject
        ) ?? null;

      if (existing) {
        const msg = addMessageToConversation({
          conversationId: existing.id,
          body,
          senderRole: "RETAINER",
        });
        setMessageFlag(msg.id, BROADCAST_MESSAGE_FLAG);
        delivered += 1;
        continue;
      }

      const created = createConversationWithFirstMessage({
        seekerId,
        retainerId,
        subject,
        body,
        senderRole: "RETAINER",
      });
      setMessageFlag(created.message.id, BROADCAST_MESSAGE_FLAG);
      delivered += 1;
    } catch {
      failed += 1;
    }
  }

  return { delivered, failed };
}
