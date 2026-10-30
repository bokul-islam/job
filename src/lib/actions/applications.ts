"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  applications, applicationStatusHistory, jobs, jobSeekerProfiles, resumes, users, companies,
} from "@/db/schema";
import { assertVerified, requireRole } from "@/lib/auth";
import { applicationsThisMonth, resolvePlan } from "@/lib/entitlements";
import { applySchema } from "@/lib/validators";
import { logActivity, logAudit } from "@/lib/logging";
import { notify } from "@/lib/notifications";
import { APPLICATION_STATUS_LABELS } from "@/lib/utils";
import type { ActionState } from "./auth";

export async function applyToJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("job_seeker");
  assertVerified(user);

  const parsed = applySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid application data." };
  const data = parsed.data;

  const jobRows = await db
    .select({ job: jobs, company: companies })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(jobs.id, data.jobId))
    .limit(1);
  const row = jobRows[0];
  if (!row || row.job.status !== "active") return { error: "This job is no longer accepting applications." };
  if (row.job.deadline && row.job.deadline.getTime() < Date.now()) {
    return { error: "The application deadline for this job has passed." };
  }

  // Duplicate prevention (reapplication only if employer allows it and previous was withdrawn)
  const existing = (await db.select().from(applications).where(and(eq(applications.jobId, data.jobId), eq(applications.seekerId, user.id))).limit(1))[0];
  if (existing && !(existing.status === "withdrawn" && row.job.allowReapply)) {
    return { error: "You have already applied to this job." };
  }

  // Entitlement: monthly application allowance
  const { plan, limits } = await resolvePlan(user);
  const used = await applicationsThisMonth(user.id);
  if (used >= limits.applicationsPerMonth) {
    return { error: `You have used all ${limits.applicationsPerMonth} applications on your ${plan?.name ?? "Free"} plan this month. Upgrade for more.` };
  }

  // Resume ownership + readiness
  if (data.resumeId) {
    const profile = (await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, user.id)).limit(1))[0];
    const resumeRows = await db
      .select()
      .from(resumes)
      .where(and(eq(resumes.id, data.resumeId), eq(resumes.seekerId, profile?.id ?? "")))
      .limit(1);
    if (!resumeRows[0] || resumeRows[0].status !== "ready") {
      return { error: "Selected resume is invalid. Upload a new resume first." };
    }
  }

  let applicationId: string;
  if (existing) {
    await db
      .update(applications)
      .set({ resumeId: data.resumeId || null, coverLetter: data.coverLetter || null, status: "submitted", updatedAt: new Date() })
      .where(eq(applications.id, existing.id));
    applicationId = existing.id;
    await db.insert(applicationStatusHistory).values({ applicationId, fromStatus: "withdrawn", toStatus: "submitted", changedById: user.id });
  } else {
    const [application] = await db
      .insert(applications)
      .values({ jobId: data.jobId, seekerId: user.id, resumeId: data.resumeId || null, coverLetter: data.coverLetter || null })
      .returning();
    applicationId = application.id;
    await db.insert(applicationStatusHistory).values({ applicationId, toStatus: "submitted", changedById: user.id });
  }

  await notify(
    row.job.employerId,
    "application",
    "application_submitted",
    `New application for “${row.job.title}”`,
    `${user.name} applied to your job post${data.coverLetter ? " with a cover letter." : "."}`,
    `/dashboard/employer/jobs/${data.jobId}/applications`,
    { email: true }
  );
  await logActivity(user.id, "application.submitted", "application", applicationId, { jobId: data.jobId });
  await logAudit(user.id, "application.submitted", "job", data.jobId);
  revalidatePath("/dashboard/seeker/applications");
  revalidatePath(`/jobs/${data.jobId}`);
  return { success: "Application submitted. Good luck!" };
}

export async function withdrawApplicationAction(applicationId: string): Promise<{ error?: string }> {
  const user = await requireRole("job_seeker");
  const app = (await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1))[0];
  if (!app || app.seekerId !== user.id) return { error: "Application not found." };
  if (["hired", "rejected", "withdrawn"].includes(app.status)) return { error: "This application can no longer be withdrawn." };
  await db.update(applications).set({ status: "withdrawn", updatedAt: new Date() }).where(eq(applications.id, applicationId));
  await db.insert(applicationStatusHistory).values({ applicationId, fromStatus: app.status, toStatus: "withdrawn", changedById: user.id });
  await logActivity(user.id, "application.withdrawn", "application", applicationId);
  revalidatePath("/dashboard/seeker/applications");
  return {};
}

const EMPLOYER_TRANSITIONS: Record<string, string[]> = {
  submitted: ["viewed", "shortlisted", "rejected", "interview"],
  viewed: ["shortlisted", "rejected", "interview"],
  shortlisted: ["interview", "rejected", "hired"],
  interview: ["hired", "rejected"],
  rejected: [],
  hired: [],
  withdrawn: [],
};

export async function updateApplicationStatusAction(applicationId: string, newStatus: string, note?: string): Promise<{ error?: string }> {
  const user = await requireRole("employer");
  const rows = await db
    .select({ application: applications, job: jobs, seeker: users })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(users, eq(users.id, applications.seekerId))
    .where(eq(applications.id, applicationId))
    .limit(1);
  const row = rows[0];
  if (!row || row.job.employerId !== user.id) return { error: "Application not found." };

  const allowed = EMPLOYER_TRANSITIONS[row.application.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return { error: `Cannot move from ${APPLICATION_STATUS_LABELS[row.application.status]} to ${newStatus}.` };
  }

  await db
    .update(applications)
    .set({ status: newStatus as typeof applications.status.enumValues[number], updatedAt: new Date() })
    .where(eq(applications.id, applicationId));
  await db.insert(applicationStatusHistory).values({
    applicationId,
    fromStatus: row.application.status,
    toStatus: newStatus as typeof applications.status.enumValues[number],
    changedById: user.id,
    note: note || null,
  });

  const label = APPLICATION_STATUS_LABELS[newStatus] ?? newStatus;
  await notify(
    row.application.seekerId,
    "application",
    `application_${newStatus}`,
    `Application update: ${label}`,
    `Your application for “${row.job.title}” is now ${label.toLowerCase()}${note ? `: ${note}` : "."}`,
    "/dashboard/seeker/applications",
    { email: true }
  );
  await logActivity(user.id, `application.${newStatus}`, "application", applicationId);
  await logAudit(user.id, `application.${newStatus}`, "application", applicationId);
  revalidatePath(`/dashboard/employer/jobs/${row.job.id}/applications`);
  return {};
}

export async function markApplicationViewedAction(applicationId: string): Promise<void> {
  const user = await requireRole("employer");
  const rows = await db
    .select({ application: applications, job: jobs })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.id, applicationId))
    .limit(1);
  const row = rows[0];
  if (!row || row.job.employerId !== user.id) return;
  if (row.application.status !== "submitted") return;
  await db.update(applications).set({ status: "viewed", updatedAt: new Date() }).where(eq(applications.id, applicationId));
  await db.insert(applicationStatusHistory).values({ applicationId, fromStatus: "submitted", toStatus: "viewed", changedById: user.id });
  await notify(row.application.seekerId, "application", "application_viewed", "Your application was viewed", `An employer viewed your application for “${row.job.title}”.`, "/dashboard/seeker/applications");
}

export async function applicationsOfSeeker(seekerId: string, status?: string) {
  const conditions = [eq(applications.seekerId, seekerId)];
  if (status) conditions.push(eq(applications.status, status as typeof applications.status.enumValues[number]));
  return db
    .select({ application: applications, job: jobs, company: companies })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(...conditions))
    .orderBy(applications.createdAt)
    .then((rows) => rows.reverse());
}

export async function applicationsForJob(jobId: string, employerId: string, statuses?: string[]) {
  const conditions = [eq(applications.jobId, jobId), eq(jobs.employerId, employerId)];
  if (statuses?.length) conditions.push(inArray(applications.status, statuses as typeof applications.status.enumValues[number][]));
  if (!statuses?.length) conditions.push(ne(applications.status, "withdrawn"));
  return db
    .select({ application: applications, seeker: users, profile: jobSeekerProfiles, job: jobs })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(users, eq(users.id, applications.seekerId))
    .leftJoin(jobSeekerProfiles, eq(jobSeekerProfiles.userId, applications.seekerId))
    .where(and(...conditions))
    .orderBy(applications.createdAt)
    .then((rows) => rows.reverse());
}
