"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  companies,
  companyMembers,
  employerProfiles,
  jobSeekerProfiles,
  notificationPreferences,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";
import {
  createSession, destroySession, hashPassword, randomToken, requireUser, sha256, verifyPassword,
} from "@/lib/auth";
import { loginSchema, passwordSchema, registerSchema } from "@/lib/validators";
import { assertRateLimit } from "@/lib/rate-limit";
import { passwordResetEmail, sendEmail, verificationEmail } from "@/lib/email";
import { logActivity, logAudit } from "@/lib/logging";
import { slugify } from "@/lib/utils";
import { z } from "zod";

export type ActionState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

async function issueEmailVerification(userId: string, email: string, name: string) {
  const token = randomToken();
  await db.insert(verificationTokens).values({
    userId,
    tokenHash: sha256(token),
    type: "email_verify",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await sendEmail(verificationEmail(email, name, token));
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await clientIp();
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    companyName: formData.get("companyName") || undefined,
    acceptTerms: formData.get("acceptTerms") === "on",
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the highlighted fields." };
  }
  const data = parsed.data;
  if (data.role === "employer" && !data.companyName) {
    return { fieldErrors: { companyName: ["Company name is required for employer accounts"] } };
  }

  try {
    assertRateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const email = data.email.toLowerCase().trim();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return { error: "An account with this email already exists." };

  const [user] = await db
    .insert(users)
    .values({ email, name: data.name, passwordHash: hashPassword(data.password), role: data.role })
    .returning();

  if (data.role === "job_seeker") {
    await db.insert(jobSeekerProfiles).values({ userId: user.id });
  } else {
    const baseSlug = slugify(data.companyName!) || "company";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
    const [company] = await db
      .insert(companies)
      .values({ name: data.companyName!, slug, createdById: user.id })
      .returning();
    await db.insert(companyMembers).values({ companyId: company.id, userId: user.id, memberRole: "owner" });
    await db.insert(employerProfiles).values({ userId: user.id, companyId: company.id });
  }
  await db.insert(notificationPreferences).values({ userId: user.id });

  await issueEmailVerification(user.id, email, data.name);
  await logActivity(user.id, "auth.registered", "user", user.id, { role: data.role });
  await createSession(user.id, ip, (await headers()).get("user-agent"));
  redirect("/dashboard?welcome=1");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await clientIp();
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };

  try {
    assertRateLimit(`login:${ip}`, 10, 10 * 60 * 1000);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }
  if (user.status === "suspended") return { error: "This account has been suspended. Contact support." };
  if (user.status === "deactivated") return { error: "This account has been deactivated." };

  await logActivity(user.id, "auth.login", "user", user.id);
  await createSession(user.id, ip, (await headers()).get("user-agent"));
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await requireUser();
  if (user.emailVerifiedAt) return { success: "Your email is already verified." };
  assertRateLimit(`verify:${user.id}`, 3, 10 * 60 * 1000);
  await issueEmailVerification(user.id, user.email, user.name);
  return { success: "Verification email sent. Check the mail outbox in development mode." };
}

export async function verifyEmailAction(token: string): Promise<ActionState> {
  if (!token) return { error: "Missing verification token." };
  const rows = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, sha256(token)),
        eq(verificationTokens.type, "email_verify"),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  const record = rows[0];
  if (!record) return { error: "This verification link is invalid or has expired." };

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, record.userId));
  await db.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, record.id));
  await logActivity(record.userId, "auth.email_verified", "user", record.userId);
  return { success: "Email verified. You now have full access." };
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const generic = { success: "If an account exists for this email, a reset link has been sent." };
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address." };
  const ip = await clientIp();
  assertRateLimit(`forgot:${ip}`, 5, 10 * 60 * 1000);

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) return generic;
  const token = randomToken();
  await db.insert(verificationTokens).values({
    userId: user.id,
    tokenHash: sha256(token),
    type: "password_reset",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await sendEmail(passwordResetEmail(email, user.name, token));
  await logAudit(user.id, "auth.password_reset_requested", "user", user.id, {}, ip);
  return generic;
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password" };

  const rows = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, sha256(token)),
        eq(verificationTokens.type, "password_reset"),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  const record = rows[0];
  if (!record) return { error: "This reset link is invalid or has expired." };

  await db.update(users).set({ passwordHash: hashPassword(parsed.data) }).where(eq(users.id, record.userId));
  await db.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, record.id));
  await db.delete(sessions).where(eq(sessions.userId, record.userId));
  await logAudit(record.userId, "auth.password_reset_completed", "user", record.userId);
  redirect("/auth/login?reset=1");
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!verifyPassword(current, user.passwordHash)) return { error: "Current password is incorrect." };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  await db.update(users).set({ passwordHash: hashPassword(parsed.data) }).where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await logAudit(user.id, "auth.password_changed", "user", user.id);
  await createSession(user.id, await clientIp(), (await headers()).get("user-agent"));
  return { success: "Password updated." };
}
