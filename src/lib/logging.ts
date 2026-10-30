import "server-only";
import { db } from "@/db";
import { activityLogs, auditLogs } from "@/db/schema";

export async function logActivity(
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  meta?: Record<string, unknown>
) {
  try {
    await db.insert(activityLogs).values({
      userId: userId ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      meta: meta ? JSON.stringify(meta) : null,
    });
  } catch (err) {
    console.error("[activity] failed to log", err);
  }
}

export async function logAudit(
  actorId: string | null,
  action: string,
  targetType?: string,
  targetId?: string,
  meta?: Record<string, unknown>,
  ip?: string | null
) {
  try {
    await db.insert(auditLogs).values({
      actorId: actorId ?? null,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      meta: meta ? JSON.stringify(meta) : null,
      ip: ip ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to log", err);
  }
}
