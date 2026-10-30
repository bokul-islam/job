"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  conversationParticipants, conversations, jobs, messages, reports, responseEvents, responseMetrics, users,
} from "@/db/schema";
import { assertVerified, requireUser } from "@/lib/auth";
import { messagesSentToday, resolvePlan } from "@/lib/entitlements";
import { assertRateLimit } from "@/lib/rate-limit";
import { reportSchema, startConversationSchema } from "@/lib/validators";
import { logActivity, logAudit } from "@/lib/logging";
import { notify } from "@/lib/notifications";
import type { ActionState } from "./auth";

async function findConversationBetween(a: string, b: string) {
  const rows = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, a));
  for (const row of rows) {
    const other = await db
      .select()
      .from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, row.conversationId), eq(conversationParticipants.userId, b)))
      .limit(1);
    if (other[0]) return row.conversationId;
  }
  return null;
}

/* --------------------------- Response-time bookkeeping --------------------------- */

async function recordMessageEvents(conversationId: string, messageId: string, senderId: string, sentAt: Date) {
  // 1. Answering closes the sender's open obligation in this conversation.
  const openForSender = await db
    .select()
    .from(responseEvents)
    .where(
      and(
        eq(responseEvents.conversationId, conversationId),
        eq(responseEvents.obligatedUserId, senderId),
        isNull(responseEvents.answeredAt)
      )
    )
    .limit(1);
  if (openForSender[0]) {
    const seconds = Math.max(0, Math.round((sentAt.getTime() - openForSender[0].receivedAt.getTime()) / 1000));
    await db
      .update(responseEvents)
      .set({ answeredAt: sentAt, responseSeconds: seconds })
      .where(eq(responseEvents.id, openForSender[0].id));
    await bumpMetricsOnAnswer(senderId, seconds);
  }

  // 2. Each other participant gains one open obligation (consecutive messages merge).
  const others = await db
    .select()
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, conversationId), sql`${conversationParticipants.userId} <> ${senderId}`));
  for (const other of others) {
    const openForOther = await db
      .select()
      .from(responseEvents)
      .where(
        and(
          eq(responseEvents.conversationId, conversationId),
          eq(responseEvents.obligatedUserId, other.userId),
          isNull(responseEvents.answeredAt)
        )
      )
      .limit(1);
    if (!openForOther[0]) {
      await db.insert(responseEvents).values({
        conversationId,
        messageId,
        obligatedUserId: other.userId,
        receivedAt: sentAt,
      });
      await bumpMetricsOnReceive(other.userId);
    }
  }
}

async function ensureMetricsRow(userId: string) {
  await db.insert(responseMetrics).values({ userId }).onConflictDoNothing();
}

async function bumpMetricsOnReceive(userId: string) {
  await ensureMetricsRow(userId);
  await db
    .update(responseMetrics)
    .set({ totalReceived: sql`${responseMetrics.totalReceived} + 1`, updatedAt: new Date() })
    .where(eq(responseMetrics.userId, userId));
}

async function bumpMetricsOnAnswer(userId: string, seconds: number) {
  await ensureMetricsRow(userId);
  const rows = await db.select().from(responseMetrics).where(eq(responseMetrics.userId, userId)).limit(1);
  const m = rows[0];
  await db
    .update(responseMetrics)
    .set({
      totalAnswered: (m?.totalAnswered ?? 0) + 1,
      totalResponseSeconds: (m?.totalResponseSeconds ?? 0) + seconds,
      fastestSeconds: m?.fastestSeconds == null || seconds < m.fastestSeconds ? seconds : m.fastestSeconds,
      slowestSeconds: m?.slowestSeconds == null || seconds > m.slowestSeconds ? seconds : m.slowestSeconds,
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(responseMetrics.userId, userId));
}

/* --------------------------------- Conversations -------------------------------- */

export async function startConversationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  assertVerified(user);
  const parsed = startConversationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Write a message to start the conversation." };
  const data = parsed.data;
  if (data.recipientId === user.id) return { error: "You cannot message yourself." };

  const recipientRows = await db.select().from(users).where(eq(users.id, data.recipientId)).limit(1);
  const recipient = recipientRows[0];
  if (!recipient || recipient.status !== "active") return { error: "Recipient not found." };
  if (!["job_seeker", "employer"].includes(user.role) || !["job_seeker", "employer"].includes(recipient.role)) {
    return { error: "Messaging is only available between job seekers and employers." };
  }

  assertRateLimit(`conv:${user.id}`, 20, 60 * 60 * 1000);
  const { limits } = await resolvePlan(user);
  const sentToday = await messagesSentToday(user.id);
  if (sentToday >= limits.messagesPerDay) {
    return { error: `Daily message limit (${limits.messagesPerDay}) reached on your plan. Upgrade for more.` };
  }

  let conversationId = await findConversationBetween(user.id, recipient.id);
  if (!conversationId) {
    const [conversation] = await db
      .insert(conversations)
      .values({ jobId: data.jobId || null, applicationId: data.applicationId || null, subject: null })
      .returning();
    conversationId = conversation.id;
    await db.insert(conversationParticipants).values([
      { conversationId, userId: user.id, lastReadAt: new Date() },
      { conversationId, userId: recipient.id },
    ]);
  }

  await sendMessageInternal(conversationId, user.id, data.body);
  await logActivity(user.id, "conversation.started", "conversation", conversationId);
  return { success: conversationId };
}

async function sendMessageInternal(conversationId: string, senderId: string, body: string, attachment?: { key: string; name: string; size: number; mime: string }) {
  const sentAt = new Date();
  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId,
      body,
      attachmentKey: attachment?.key ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentSize: attachment?.size ?? null,
      attachmentMime: attachment?.mime ?? null,
    })
    .returning();
  await db.update(conversations).set({ lastMessageAt: sentAt }).where(eq(conversations.id, conversationId));
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: sentAt })
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, senderId)));

  await recordMessageEvents(conversationId, message.id, senderId, sentAt);

  // Notify recipients (in-app + optional email)
  const recipients = await db
    .select({ user: users })
    .from(conversationParticipants)
    .innerJoin(users, eq(users.id, conversationParticipants.userId))
    .where(and(eq(conversationParticipants.conversationId, conversationId), sql`${conversationParticipants.userId} <> ${senderId}`));
  const senderRows = await db.select().from(users).where(eq(users.id, senderId)).limit(1);
  const senderName = senderRows[0]?.name ?? "Someone";
  for (const { user: recipient } of recipients) {
    await notify(
      recipient.id,
      "message",
      "new_message",
      `New message from ${senderName}`,
      body.length > 140 ? `${body.slice(0, 140)}…` : body,
      `/inbox?c=${conversationId}`,
      { email: true }
    );
  }
  return message;
}

export async function sendMessageAction(input: {
  conversationId: string;
  body: string;
  attachment?: { key: string; name: string; size: number; mime: string };
}): Promise<{ error?: string; id?: string }> {
  const user = await requireUser();
  assertVerified(user);

  const participant = (
    await db
      .select()
      .from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, input.conversationId), eq(conversationParticipants.userId, user.id)))
      .limit(1)
  )[0];
  if (!participant) return { error: "You are not part of this conversation." };

  const others = await db
    .select()
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, input.conversationId), sql`${conversationParticipants.userId} <> ${user.id}`));
  if (others.some((o) => o.blocked)) return { error: "You cannot send messages in this conversation." };

  const body = input.body?.trim() ?? "";
  if (!body && !input.attachment) return { error: "Message cannot be empty." };
  if (body.length > 4000) return { error: "Message is too long (max 4000 characters)." };

  const { limits } = await resolvePlan(user);
  const sentToday = await messagesSentToday(user.id);
  if (sentToday >= limits.messagesPerDay) {
    return { error: `Daily message limit (${limits.messagesPerDay}) reached on your plan.` };
  }

  const message = await sendMessageInternal(input.conversationId, user.id, body, input.attachment);
  return { id: message.id };
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const user = await requireUser();
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, user.id)));
}

export async function setBlockAction(conversationId: string, block: boolean): Promise<{ error?: string }> {
  const user = await requireUser();
  // The blocked flag lives on the *other* participant's row: it blocks them from sending.
  const others = await db
    .select()
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, conversationId), sql`${conversationParticipants.userId} <> ${user.id}`));
  if (!others[0]) return { error: "Conversation not found." };
  await db.update(conversationParticipants).set({ blocked: block }).where(eq(conversationParticipants.id, others[0].id));
  await logAudit(user.id, block ? "conversation.blocked" : "conversation.unblocked", "conversation", conversationId);
  return {};
}

export async function submitReportAction(input: unknown): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid report." };
  await db.insert(reports).values({
    reporterId: user.id,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
  });
  await logAudit(user.id, "report.submitted", parsed.data.targetType, parsed.data.targetId, { reason: parsed.data.reason });
  return {};
}

export async function latestMessages(conversationId: string, userId: string) {
  const participant = (
    await db
      .select()
      .from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)))
      .limit(1)
  )[0];
  if (!participant) return [];
  return db
    .select({ message: messages, sender: users })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(100)
    .then((rows) => rows.reverse());
}

export async function jobOfConversation(conversationId: string) {
  const rows = await db
    .select({ job: jobs })
    .from(conversations)
    .innerJoin(jobs, eq(jobs.id, conversations.jobId))
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return rows[0]?.job ?? null;
}
