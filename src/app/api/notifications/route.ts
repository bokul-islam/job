import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
  const [unread] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
  return NextResponse.json({ notifications: rows, unread: unread?.count ?? 0 });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean };
  if (body.all) {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, user.id));
  } else if (body.id) {
    await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, body.id), eq(notifications.userId, user.id)));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (body.id) {
    await db.delete(notifications).where(and(eq(notifications.id, body.id), eq(notifications.userId, user.id)));
  }
  return NextResponse.json({ ok: true });
}
