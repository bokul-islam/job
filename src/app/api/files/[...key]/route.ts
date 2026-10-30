import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { applications, conversationParticipants, jobs, jobSeekerProfiles, resumes, videoCvs } from "@/db/schema";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { localPathForKey, readLocalFile, r2Configured } from "@/lib/storage";

/**
 * Private file access. Every request is authorised on the server:
 *  - resumes: owner, admins, or an employer who received this resume in an application
 *  - video CVs: owner, admins, or employers when visibility allows (or public)
 *  - message attachments: participants of the parent conversation only
 *  - logos/avatars: public
 */

const PUBLIC_PREFIXES = ["logos/", "avatars/"];

function mimeFor(key: string): string {
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".mp4")) return "video/mp4";
  if (key.endsWith(".webm")) return "video/webm";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

export async function GET(_request: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await ctx.params;
  const key = segments.map((s) => decodeURIComponent(s)).join("/");

  if (PUBLIC_PREFIXES.some((p) => key.startsWith(p))) {
    return serveFile(key);
  }

  const user = await getSessionUser();
  if (!user || user.status !== "active") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isAdmin(user)) return serveFile(key);

  if (key.startsWith("resumes/")) {
    const rows = await db.select().from(resumes).where(eq(resumes.fileKey, key)).limit(1);
    const resume = rows[0];
    if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const profile = (await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.id, resume.seekerId)).limit(1))[0];
    if (profile?.userId === user.id) return serveFile(key);
    if (user.role === "employer") {
      const apps = await db
        .select({ id: applications.id })
        .from(applications)
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .where(and(eq(applications.resumeId, resume.id), eq(jobs.employerId, user.id)))
        .limit(1);
      if (apps[0]) return serveFile(key);
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (key.startsWith("video_cvs/")) {
    const rows = await db.select().from(videoCvs).where(eq(videoCvs.fileKey, key)).limit(1);
    const video = rows[0];
    if (!video || video.status !== "ready") return NextResponse.json({ error: "Not found" }, { status: 404 });
    const profile = (await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.id, video.seekerId)).limit(1))[0];
    if (profile?.userId === user.id) return serveFile(key);
    if (video.visibility === "public") return serveFile(key);
    if (video.visibility === "employers" && user.role === "employer" && user.emailVerifiedAt) return serveFile(key);
    return NextResponse.json({ error: "This video CV is private." }, { status: 403 });
  }

  if (key.startsWith("attachments/")) {
    const conversationId = segments[1];
    const participant = (
      await db
        .select()
        .from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, user.id)))
        .limit(1)
    )[0];
    if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return serveFile(key);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

async function serveFile(key: string) {
  try {
    localPathForKey(key); // path traversal guard
  } catch {
    return NextResponse.json({ error: "Bad key" }, { status: 400 });
  }
  if (r2Configured()) {
    try {
      const { GetObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
      });
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }), { expiresIn: 300 });
      return NextResponse.redirect(url);
    } catch (err) {
      console.error("[files] R2 sign failed", err);
      return NextResponse.json({ error: "Storage error" }, { status: 500 });
    }
  }
  const data = await readLocalFile(key);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeFor(key),
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": "inline",
    },
  });
}
