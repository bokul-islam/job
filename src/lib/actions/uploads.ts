"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { jobSeekerProfiles, resumes, videoCvs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolvePlan } from "@/lib/entitlements";
import { deleteLocalFile, localFileExists, contentLengthLocal, maxVideoDurationSeconds } from "@/lib/storage";
import { logActivity } from "@/lib/logging";
import type { ActionState } from "./auth";

async function mySeekerProfile() {
  const user = await requireRole("job_seeker");
  let profile = (await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, user.id)).limit(1))[0];
  if (!profile) [profile] = await db.insert(jobSeekerProfiles).values({ userId: user.id }).returning();
  return { user, profile };
}

export async function confirmResumeUploadAction(input: {
  key: string; fileName: string; size: number; mimeType: string; title: string;
}): Promise<{ error?: string; success?: string; id?: string }> {
  const { user, profile } = await mySeekerProfile();
  if (input.mimeType !== "application/pdf") return { error: "Only PDF resumes are accepted." };
  if (input.size > 10 * 1024 * 1024) return { error: "Resume exceeds 10 MB." };
  const exists = await localFileExists(input.key);
  if (!exists && !input.key.includes("/")) return { error: "Uploaded file could not be verified." };
  if (!exists && process.env.R2_ACCOUNT_ID == null) return { error: "Uploaded file could not be verified on the server." };
  const onDisk = await contentLengthLocal(input.key);
  if (onDisk != null && Math.abs(onDisk - input.size) > 0) return { error: "Uploaded size mismatch." };

  const [resume] = await db
    .insert(resumes)
    .values({
      seekerId: profile.id,
      title: input.title?.trim() || input.fileName,
      fileKey: input.key,
      fileName: input.fileName,
      fileSize: input.size,
      mimeType: input.mimeType,
      status: "ready",
    })
    .returning();
  const [count] = await db.select({ id: resumes.id }).from(resumes).where(eq(resumes.seekerId, profile.id));
  if (!count) await db.update(resumes).set({ isPrimary: true }).where(eq(resumes.id, resume.id));
  await logActivity(user.id, "resume.uploaded", "resume", resume.id);
  revalidatePath("/dashboard/seeker/profile");
  return { success: "Resume uploaded.", id: resume.id };
}

export async function confirmVideoCvUploadAction(input: {
  key: string; fileName: string; size: number; mimeType: string; title: string; description: string; durationSeconds?: number;
}): Promise<ActionState & { id?: string }> {
  const { user, profile } = await mySeekerProfile();
  const { plan, limits } = await resolvePlan(user);
  if (!limits.videoCvAllowed) {
    return { error: `Video CVs require the Standard plan or above. Your current plan: ${plan?.name ?? "Free"}.` };
  }
  if (!["video/mp4", "video/webm"].includes(input.mimeType)) return { error: "Only MP4 and WebM videos are accepted." };
  const maxDuration = await maxVideoDurationSeconds();
  if (input.durationSeconds && input.durationSeconds > maxDuration) {
    return { error: `Video is ${Math.round(input.durationSeconds)}s — the limit is ${maxDuration}s.` };
  }
  const exists = await localFileExists(input.key);
  if (!exists && process.env.R2_ACCOUNT_ID == null) return { error: "Uploaded file could not be verified on the server." };

  const [video] = await db
    .insert(videoCvs)
    .values({
      seekerId: profile.id,
      title: input.title?.trim() || "Video CV",
      description: input.description?.trim() || null,
      fileKey: input.key,
      fileName: input.fileName,
      fileSize: input.size,
      mimeType: input.mimeType,
      durationSeconds: input.durationSeconds ? Math.round(input.durationSeconds) : null,
      status: "ready",
    })
    .returning();
  await logActivity(user.id, "video_cv.uploaded", "video_cv", video.id);
  revalidatePath("/dashboard/seeker/video-cv");
  return { success: "Video CV published.", id: video.id };
}

export async function deleteVideoCvAction(id: string): Promise<void> {
  const { user, profile } = await mySeekerProfile();
  const rows = await db.select().from(videoCvs).where(and(eq(videoCvs.id, id), eq(videoCvs.seekerId, profile.id))).limit(1);
  if (rows[0]) {
    await deleteLocalFile(rows[0].fileKey);
    await db.delete(videoCvs).where(eq(videoCvs.id, id));
    await logActivity(user.id, "video_cv.deleted", "video_cv", id);
  }
  revalidatePath("/dashboard/seeker/video-cv");
}

export async function updateVideoCvAction(id: string, input: { title: string; description: string; visibility: "private" | "employers" | "public" }): Promise<{ error?: string }> {
  const { profile } = await mySeekerProfile();
  if (!input.title.trim()) return { error: "Title is required." };
  await db
    .update(videoCvs)
    .set({ title: input.title.trim(), description: input.description.trim() || null, visibility: input.visibility })
    .where(and(eq(videoCvs.id, id), eq(videoCvs.seekerId, profile.id)));
  revalidatePath("/dashboard/seeker/video-cv");
  return {};
}
