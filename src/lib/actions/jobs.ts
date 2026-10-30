"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { employerProfiles, jobs, jobSkills, savedJobs, skills } from "@/db/schema";
import { assertVerified, requireRole } from "@/lib/auth";
import { activeJobPostCount, resolvePlan } from "@/lib/entitlements";
import { jobSchema } from "@/lib/validators";
import { logActivity, logAudit } from "@/lib/logging";
import { notify } from "@/lib/notifications";
import { slugify } from "@/lib/utils";
import type { ActionState } from "./auth";

async function syncJobSkills(jobId: string, skillNames: string) {
  await db.delete(jobSkills).where(eq(jobSkills.jobId, jobId));
  const names = skillNames.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 15);
  for (const name of names) {
    let skill = (await db.select().from(skills).where(eq(skills.name, name)).limit(1))[0];
    if (!skill) [skill] = await db.insert(skills).values({ name }).returning();
    await db.insert(jobSkills).values({ jobId, skillId: skill.id });
  }
}

function jobValues(data: z.infer<typeof jobSchema>) {
  return {
    title: data.title,
    categoryId: data.categoryId || null,
    jobType: data.jobType,
    workplaceType: data.workplaceType,
    experienceLevel: data.experienceLevel,
    location: data.location,
    salaryMin: data.salaryMin ?? null,
    salaryMax: data.salaryMax ?? null,
    salaryPeriod: data.salaryPeriod,
    description: data.description,
    responsibilities: data.responsibilities || null,
    requirements: data.requirements || null,
    benefits: data.benefits || null,
    vacancies: data.vacancies,
    deadline: data.deadline ? new Date(`${data.deadline}T23:59:59`) : null,
    allowReapply: data.allowReapply,
    updatedAt: new Date(),
  };
}

export async function createJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("employer");
  assertVerified(user);

  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the highlighted fields." };
  const data = parsed.data;

  const employer = (await db.select().from(employerProfiles).where(eq(employerProfiles.userId, user.id)).limit(1))[0];
  if (!employer?.companyId) return { error: "Complete your company profile before posting jobs." };

  if (data.action === "publish") {
    const { plan, limits } = await resolvePlan(user);
    const activeCount = await activeJobPostCount(user.id);
    if (activeCount >= limits.activeJobPosts) {
      return { error: `Your ${plan?.name ?? "Free"} plan allows ${limits.activeJobPosts} active job post(s). Upgrade to publish more.` };
    }
  }

  const slug = `${slugify(data.title) || "job"}-${Math.random().toString(36).slice(2, 8)}`;
  const [job] = await db
    .insert(jobs)
    .values({
      ...jobValues(data),
      slug,
      employerId: user.id,
      companyId: employer.companyId,
      status: data.action === "publish" ? "active" : "draft",
    })
    .returning();
  await syncJobSkills(job.id, data.skillNames ?? "");
  await logActivity(user.id, "job.created", "job", job.id, { status: job.status });
  await logAudit(user.id, "job.created", "job", job.id);
  redirect(`/dashboard/employer/jobs?created=${job.id}`);
}

export async function updateJobAction(jobId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("employer");
  const existing = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!existing || existing.employerId !== user.id) return { error: "Job not found." };

  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the highlighted fields." };
  const data = parsed.data;

  let status = existing.status;
  if (data.action === "publish" && existing.status !== "active") {
    const { plan, limits } = await resolvePlan(user);
    const activeCount = await activeJobPostCount(user.id);
    if (activeCount >= limits.activeJobPosts) {
      return { error: `Your ${plan?.name ?? "Free"} plan allows ${limits.activeJobPosts} active job post(s). Upgrade to publish more.` };
    }
    status = "active";
  }
  if (data.action === "draft" && existing.status === "active") status = "paused";

  await db.update(jobs).set({ ...jobValues(data), status }).where(eq(jobs.id, jobId));
  await syncJobSkills(jobId, data.skillNames ?? "");
  await logActivity(user.id, "job.updated", "job", jobId);
  revalidatePath("/dashboard/employer/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return { success: status === "active" ? "Job saved and published." : "Job saved." };
}

export async function setJobStatusAction(jobId: string, status: "active" | "paused" | "closed"): Promise<{ error?: string }> {
  const user = await requireRole("employer");
  const existing = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!existing || existing.employerId !== user.id) return { error: "Job not found." };

  if (status === "active") {
    assertVerified(user);
    const { plan, limits } = await resolvePlan(user);
    const activeCount = await activeJobPostCount(user.id);
    if (existing.status !== "active" && activeCount >= limits.activeJobPosts) {
      return { error: `Your ${plan?.name ?? "Free"} plan allows ${limits.activeJobPosts} active job post(s).` };
    }
  }
  await db.update(jobs).set({ status, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  if (status === "active") {
    await notify(user.id, "membership", "job_published", `“${existing.title}” is now live`, "Your job post is now visible to candidates.", `/jobs/${jobId}`);
  }
  await logActivity(user.id, `job.${status}`, "job", jobId);
  revalidatePath("/dashboard/employer/jobs");
  return {};
}

export async function deleteJobAction(jobId: string): Promise<void> {
  const user = await requireRole("employer");
  await db.delete(jobs).where(and(eq(jobs.id, jobId), eq(jobs.employerId, user.id), eq(jobs.status, "draft")));
  await logAudit(user.id, "job.deleted", "job", jobId);
  revalidatePath("/dashboard/employer/jobs");
}

export async function toggleSaveJobAction(jobId: string): Promise<{ saved: boolean }> {
  const user = await requireRole("job_seeker");
  const existing = (await db.select().from(savedJobs).where(and(eq(savedJobs.jobId, jobId), eq(savedJobs.seekerId, user.id))).limit(1))[0];
  if (existing) {
    await db.delete(savedJobs).where(eq(savedJobs.id, existing.id));
    revalidatePath("/dashboard/seeker/saved");
    return { saved: false };
  }
  const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!job || job.status !== "active") throw new Error("Job is no longer available");
  await db.insert(savedJobs).values({ jobId, seekerId: user.id });
  revalidatePath("/dashboard/seeker/saved");
  return { saved: true };
}
