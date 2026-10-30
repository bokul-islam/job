import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { presignUpload, type UploadPurpose } from "@/lib/storage";
import { assertRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    assertRateLimit(`presign:${user.id}`, 20, 10 * 60 * 1000);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    purpose?: UploadPurpose;
    fileName?: string;
    contentType?: string;
    size?: number;
  } | null;
  if (!body?.purpose || !body.fileName || !body.contentType || typeof body.size !== "number") {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }
  if (body.purpose === "resume" || body.purpose === "video_cv") {
    if (user.role !== "job_seeker") return NextResponse.json({ error: "Only job seekers can upload resumes and video CVs." }, { status: 403 });
  }

  const result = await presignUpload({
    userId: user.id,
    purpose: body.purpose,
    fileName: body.fileName,
    contentType: body.contentType,
    size: body.size,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
