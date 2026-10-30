"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  companies, jobs, membershipPlans, paymentWebhookEvents, planEntitlements, platformSettings, reports, users,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { planSchema } from "@/lib/validators";
import { logAudit } from "@/lib/logging";
import { notify } from "@/lib/notifications";
import { slugify } from "@/lib/utils";
import type { ActionState } from "./auth";

export async function setUserStatusAction(userId: string, status: "active" | "suspended" | "deactivated"): Promise<{ error?: string }> {
  const admin = await requireRole("admin", "super_admin");
  const target = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!target) return { error: "User not found." };
  if (target.role === "super_admin" && admin.role !== "super_admin") return { error: "Only a super admin can modify super admin accounts." };
  if (target.id === admin.id) return { error: "You cannot change your own account status." };
  if (["admin", "super_admin"].includes(target.role) && admin.role !== "super_admin") return { error: "Only a super admin can manage admin accounts." };
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
  await logAudit(admin.id, `admin.user_${status}`, "user", userId);
  revalidatePath("/dashboard/admin/users");
  return {};
}

export async function setUserRoleAction(userId: string, role: "admin" | "job_seeker"): Promise<{ error?: string }> {
  const admin = await requireRole("super_admin");
  if (userId === admin.id) return { error: "You cannot modify your own role." };
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  await logAudit(admin.id, `admin.role_${role}`, "user", userId);
  revalidatePath("/dashboard/admin/users");
  return {};
}

export async function setCompanyVerifiedAction(companyId: string, verified: boolean): Promise<{ error?: string }> {
  const admin = await requireRole("admin", "super_admin");
  await db.update(companies).set({ verified, updatedAt: new Date() }).where(eq(companies.id, companyId));
  await logAudit(admin.id, verified ? "admin.company_verified" : "admin.company_unverified", "company", companyId);
  revalidatePath("/dashboard/admin/users");
  return {};
}

export async function moderateJobAction(jobId: string, action: "flag" | "unflag" | "close"): Promise<{ error?: string }> {
  const admin = await requireRole("admin", "super_admin");
  const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!job) return { error: "Job not found." };
  if (action === "flag") await db.update(jobs).set({ flagged: true }).where(eq(jobs.id, jobId));
  if (action === "unflag") await db.update(jobs).set({ flagged: false }).where(eq(jobs.id, jobId));
  if (action === "close") await db.update(jobs).set({ status: "closed", updatedAt: new Date() }).where(eq(jobs.id, jobId));
  await logAudit(admin.id, `admin.job_${action}`, "job", jobId);
  if (action !== "unflag") {
    await notify(job.employerId, "membership", "job_moderated", "Job post moderation update", `Your job “${job.title}” was ${action === "close" ? "closed" : "flagged for review"} by the moderation team.`, `/dashboard/employer/jobs`);
  }
  revalidatePath("/dashboard/admin/jobs");
  return {};
}

export async function upsertPlanAction(planId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole("super_admin");
  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    audience: formData.get("audience"),
    priceMonthly: formData.get("priceMonthly"),
    priceYearly: formData.get("priceYearly"),
    description: formData.get("description"),
    features: formData.get("features"),
    isActive: formData.get("isActive") === "on",
    entitlements: {
      applications_per_month: formData.get("applications_per_month") || undefined,
      active_job_posts: formData.get("active_job_posts") || undefined,
      messages_per_day: formData.get("messages_per_day") || undefined,
      candidate_searches_per_day: formData.get("candidate_searches_per_day") || undefined,
      video_cv: formData.get("video_cv") === "on",
      featured_candidate: formData.get("featured_candidate") === "on",
      advanced_analytics: formData.get("advanced_analytics") === "on",
      featured_jobs: formData.get("featured_jobs") === "on",
    },
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the fields." };
  const data = parsed.data;

  const planValues = {
    name: data.name,
    audience: data.audience,
    priceMonthly: data.priceMonthly,
    priceYearly: data.priceYearly,
    description: data.description || null,
    features: (data.features ?? "").split("\n").map((f) => f.trim()).filter(Boolean),
    isActive: data.isActive,
    updatedAt: new Date(),
  };

  let targetId = planId;
  if (targetId) {
    await db.update(membershipPlans).set(planValues).where(eq(membershipPlans.id, targetId));
  } else {
    const slug = `${data.audience}-${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const [plan] = await db.insert(membershipPlans).values({ ...planValues, slug }).returning();
    targetId = plan.id;
  }

  await db.delete(planEntitlements).where(eq(planEntitlements.planId, targetId));
  const entries: { key: string; valueInt?: number | null; valueBool?: boolean | null }[] = [];
  for (const [key, value] of Object.entries(data.entitlements)) {
    if (value === undefined || value === null || (typeof value === "number" && !Number.isFinite(value))) continue;
    if (typeof value === "boolean") entries.push({ key, valueBool: value });
    else entries.push({ key, valueInt: value as number });
  }
  if (entries.length) await db.insert(planEntitlements).values(entries.map((e) => ({ planId: targetId!, key: e.key, valueInt: e.valueInt ?? null, valueBool: e.valueBool ?? null })));

  await logAudit(admin.id, planId ? "admin.plan_updated" : "admin.plan_created", "membership_plan", targetId!);
  revalidatePath("/dashboard/admin/plans");
  revalidatePath("/pricing");
  return { success: "Plan saved." };
}

export async function resolveReportAction(reportId: string, status: "resolved" | "dismissed", note: string): Promise<{ error?: string }> {
  const admin = await requireRole("admin", "super_admin");
  await db
    .update(reports)
    .set({ status, resolutionNote: note || null, resolvedById: admin.id, resolvedAt: new Date() })
    .where(eq(reports.id, reportId));
  await logAudit(admin.id, `admin.report_${status}`, "report", reportId);
  revalidatePath("/dashboard/admin/reports");
  return {};
}

const EDITABLE_SETTINGS = new Set(["video_max_size_mb", "video_max_duration_seconds", "platform_name", "allow_signups", "maintenance_notice"]);

export async function updateSettingAction(key: string, value: string): Promise<{ error?: string }> {
  const admin = await requireRole("super_admin");
  if (!EDITABLE_SETTINGS.has(key)) return { error: "Unknown setting." };
  if (["video_max_size_mb", "video_max_duration_seconds"].includes(key)) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 1024) return { error: "Must be a positive number (max 1024)." };
    value = String(n);
  }
  await db
    .insert(platformSettings)
    .values({ key, value, updatedAt: new Date(), updatedById: admin.id })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date(), updatedById: admin.id } });
  await logAudit(admin.id, "admin.setting_updated", "setting", undefined, { key, value });
  revalidatePath("/dashboard/admin/settings");
  return {};
}

export async function recentWebhookEvents() {
  return db.select().from(paymentWebhookEvents).orderBy(desc(paymentWebhookEvents.createdAt)).limit(25);
}

export async function deleteExpiredSessionsInfo() {
  return null;
}
