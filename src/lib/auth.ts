import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq, gt, and } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { hashPassword, randomToken, sha256, verifyPassword } from "@/lib/passwords";

export { hashPassword, randomToken, sha256, verifyPassword };

const SESSION_COOKIE = "tb_session";
const SESSION_TTL_DAYS = 30;

/* ---------------------------------- Sessions ---------------------------------- */

export async function createSession(userId: string, ip?: string | null, userAgent?: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    userId,
    ip: ip ?? null,
    userAgent: userAgent ?? null,
    expiresAt,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export const getSessionUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.status !== "active") redirect("/auth/login?error=suspended");
  return user;
}

export async function requireRole(...roles: User["role"][]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard?error=forbidden");
  return user;
}

export function isAdmin(user: User | null) {
  return !!user && (user.role === "admin" || user.role === "super_admin");
}

export function assertRole(user: User, ...roles: User["role"][]) {
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden: insufficient permissions");
  }
}

export function assertVerified(user: User) {
  if (!user.emailVerifiedAt) {
    throw new Error("Please verify your email address before performing this action.");
  }
}
