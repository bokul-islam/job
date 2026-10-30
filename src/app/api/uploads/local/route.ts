import { NextResponse } from "next/server";
import { verifyUploadToken, writeLocalFile } from "@/lib/storage";
import { getSessionUser } from "@/lib/auth";

/** Development storage driver: receives the file stream authorised by an HMAC token. */
export async function PUT(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const payload = verifyUploadToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired upload token." }, { status: 403 });

  const user = await getSessionUser();
  if (!user || user.id !== payload.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!contentLength || contentLength !== payload.size) {
    return NextResponse.json({ error: "File size mismatch." }, { status: 400 });
  }
  const data = Buffer.from(await request.arrayBuffer());
  if (data.byteLength !== payload.size) {
    return NextResponse.json({ error: "File size mismatch." }, { status: 400 });
  }

  // Magic-byte validation (do not trust the extension / declared MIME alone)
  if (payload.purpose === "resume" && data.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "File is not a valid PDF." }, { status: 400 });
  }
  if (payload.purpose === "video_cv") {
    const head = data.subarray(0, 32).toString("latin1");
    const isMp4 = head.includes("ftyp");
    const isWebm = data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (!isMp4 && !isWebm) return NextResponse.json({ error: "File is not a valid MP4/WebM video." }, { status: 400 });
  }

  await writeLocalFile(payload.key, data);
  return NextResponse.json({ ok: true, key: payload.key });
}
