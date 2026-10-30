"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  education, jobSeekerProfiles, jobSeekerSkills, resumes, skills, videoCvs, workExperience,
} from "@/db/schema";
import { requireRole, requireUser } from "@/lib/auth";
import { companyProfileCompletion } from "@/lib/queries";
import { companySchema, seekerProfileSchema } from "@/lib/validators";
import { companies, employerProfiles } from "@/db/schema";
import { logActivity } from "@/lib/logging";
import { slugify } from "@/lib/utils";
import type { ActionState } from "./auth";

async function computeSeekerCompletion(profileId: string): Promise<number> {
  const rows = await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.id, profileId)).limit(1);
  const p = rows[0];
  if (!p) return 0;
  const [skillRows, eduRows, expRows, resumeRows] = await Promise.all([
    db.select().from(jobSeekerSkills).where(eq(jobSeekerSkills.seekerId, profileId)),
    db.select().from(education).where(eq(education.seekerId, profileId)),
    db.select().from(workExperience).where(eq(workExperience.seekerId, profileId)),
    db.select().from(resumes).where(and(eq(resumes.seekerId, profileId), eq(resumes.status, "ready"))),
  ]);
  const checks = [
    !!p.headline, !!p.bio, !!p.location, !!p.phone, !!p.currentTitle,
    skillRows.length > 0, eduRows.length > 0, expRows.length > 0, resumeRows.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function updateSeekerProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("job_seeker");
  const parsed = seekerProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the highlighted fields." };
  }
  const data = parsed.data;

  let profile = (await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, user.id)).limit(1))[0];
  if (!profile) {
    [profile] = await db.insert(jobSeekerProfiles).values({ userId: user.id }).returning();
  }

  await db
    .update(jobSeekerProfiles)
    .set({
      headline: data.headline || null,
      bio: data.bio || null,
      location: data.location || null,
      phone: data.phone || null,
      website: data.website || null,
      currentTitle: data.currentTitle || null,
      yearsExperience: data.yearsExperience ?? null,
      expectedSalaryMin: data.expectedSalaryMin ?? null,
      expectedSalaryMax: data.expectedSalaryMax ?? null,
      availability: data.availability || null,
      visibility: data.visibility,
      updatedAt: new Date(),
    })
    .where(eq(jobSeekerProfiles.id, profile.id));

  // skills: comma-separated names
  await db.delete(jobSeekerSkills).where(eq(jobSeekerSkills.seekerId, profile.id));
  const names = (data.skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  for (const name of names) {
    let skill = (await db.select().from(skills).where(eq(skills.name, name)).limit(1))[0];
    if (!skill) [skill] = await db.insert(skills).values({ name }).returning();
    await db.insert(jobSeekerSkills).values({ seekerId: profile.id, skillId: skill.id });
  }

  const pct = await computeSeekerCompletion(profile.id);
  await db.update(jobSeekerProfiles).set({ completionPct: pct }).where(eq(jobSeekerProfiles.id, profile.id));

  await logActivity(user.id, "profile.updated", "job_seeker_profile", profile.id);
  revalidatePath("/dashboard/seeker/profile");
  revalidatePath("/dashboard/seeker");
  return { success: "Profile saved." };
}

const educationSchema = z.object({
  institution: z.string().min(2).max(140),
  degree: z.string().min(2).max(140),
  field: z.string().max(140).optional().or(z.literal("")),
  startYear: z.coerce.number().int().min(1950).max(2100).optional().or(z.literal("").transform(() => undefined)),
  endYear: z.coerce.number().int().min(1950).max(2100).optional().or(z.literal("").transform(() => undefined)),
});

const experienceSchema = z.object({
  company: z.string().min(2).max(140),
  title: z.string().min(2).max(140),
  location: z.string().max(140).optional().or(z.literal("")),
  isCurrent: z.coerce.boolean().default(false),
  startDate: z.string().max(20).optional().or(z.literal("")),
  endDate: z.string().max(20).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
});

async function getMySeekerProfile() {
  const user = await requireRole("job_seeker");
  let profile = (await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, user.id)).limit(1))[0];
  if (!profile) [profile] = await db.insert(jobSeekerProfiles).values({ userId: user.id }).returning();
  return { user, profile };
}

export async function addEducationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await getMySeekerProfile();
  const parsed = educationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the fields." };
  await db.insert(education).values({
    seekerId: profile.id,
    institution: parsed.data.institution,
    degree: parsed.data.degree,
    field: parsed.data.field || null,
    startYear: parsed.data.startYear ?? null,
    endYear: parsed.data.endYear ?? null,
  });
  revalidatePath("/dashboard/seeker/profile");
  return { success: "Education added." };
}

export async function deleteEducationAction(id: string): Promise<void> {
  const { profile } = await getMySeekerProfile();
  await db.delete(education).where(and(eq(education.id, id), eq(education.seekerId, profile.id)));
  revalidatePath("/dashboard/seeker/profile");
}

export async function addExperienceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await getMySeekerProfile();
  const parsed = experienceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the fields." };
  await db.insert(workExperience).values({
    seekerId: profile.id,
    company: parsed.data.company,
    title: parsed.data.title,
    location: parsed.data.location || null,
    isCurrent: parsed.data.isCurrent,
    startDate: parsed.data.startDate || null,
    endDate: parsed.data.isCurrent ? null : parsed.data.endDate || null,
    description: parsed.data.description || null,
  });
  revalidatePath("/dashboard/seeker/profile");
  return { success: "Experience added." };
}

export async function deleteExperienceAction(id: string): Promise<void> {
  const { profile } = await getMySeekerProfile();
  await db.delete(workExperience).where(and(eq(workExperience.id, id), eq(workExperience.seekerId, profile.id)));
  revalidatePath("/dashboard/seeker/profile");
}

export async function detachResumeAction(id: string): Promise<void> {
  const { user, profile } = await getMySeekerProfile();
  const rows = await db.select().from(resumes).where(and(eq(resumes.id, id), eq(resumes.seekerId, profile.id))).limit(1);
  if (rows[0]) {
    const { deleteLocalFile } = await import("@/lib/storage");
    await deleteLocalFile(rows[0].fileKey);
    await db.delete(resumes).where(eq(resumes.id, id));
  }
  await logActivity(user.id, "resume.deleted", "resume", id);
  revalidatePath("/dashboard/seeker/profile");
}

export async function setPrimaryResumeAction(id: string): Promise<void> {
  const { profile } = await getMySeekerProfile();
  await db.update(resumes).set({ isPrimary: false }).where(eq(resumes.seekerId, profile.id));
  await db.update(resumes).set({ isPrimary: true }).where(and(eq(resumes.id, id), eq(resumes.seekerId, profile.id)));
  revalidatePath("/dashboard/seeker/profile");
}

export async function updateCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole("employer");
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Please fix the highlighted fields." };
  const data = parsed.data;

  let employerRow = (await db.select().from(employerProfiles).where(eq(employerProfiles.userId, user.id)).limit(1))[0];
  if (!employerRow) [employerRow] = await db.insert(employerProfiles).values({ userId: user.id }).returning();

  const values = {
    name: data.name,
    tagline: data.tagline || null,
    description: data.description || null,
    website: data.website || null,
    industry: data.industry || null,
    size: data.size || null,
    location: data.location || null,
    foundedYear: data.foundedYear ?? null,
    updatedAt: new Date(),
  };

  let companyId = employerRow.companyId;
  if (companyId) {
    await db.update(companies).set(values).where(eq(companies.id, companyId));
  } else {
    const slug = `${slugify(data.name) || "company"}-${Math.random().toString(36).slice(2, 7)}`;
    const [company] = await db.insert(companies).values({ ...values, slug, createdById: user.id }).returning();
    companyId = company.id;
    await db.update(employerProfiles).set({ companyId }).where(eq(employerProfiles.id, employerRow.id));
  }

  const pct = await companyProfileCompletion(companyId);
  await db.update(employerProfiles).set({ completionPct: pct, updatedAt: new Date() }).where(eq(employerProfiles.id, employerRow.id));
  await logActivity(user.id, "company.updated", "company", companyId ?? undefined);
  revalidatePath("/dashboard/employer/company");
  return { success: "Company profile saved." };
}

export async function getVideoCvList() {
  const user = await requireUser();
  const profile = (await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, user.id)).limit(1))[0];
  if (!profile) return [];
  return db.select().from(videoCvs).where(eq(videoCvs.seekerId, profile.id));
}
