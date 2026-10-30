import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";

/**
 * Storage abstraction.
 *
 *  - Production driver: Cloudflare R2 (S3-compatible). The client receives a
 *    short-lived presigned PUT URL and uploads directly browser -> R2.
 *    Downloads use presigned GET URLs. Activated when R2_* env vars are set.
 *  - Development driver: streams through the app server to a local ./storage
 *    directory, authorised by the same validation + HMAC-signed upload tokens
 *    so the flow is identical from the client's perspective.
 */

const STORAGE_DIR = path.join(process.cwd(), "storage", "uploads");
const SIGNING_SECRET = process.env.UPLOAD_SIGNING_SECRET ?? "dev-upload-secret-change-me";

export type UploadPurpose = "resume" | "video_cv" | "attachment" | "avatar" | "logo";

const ALLOWED_MIME: Record<UploadPurpose, string[]> = {
  resume: ["application/pdf"],
  video_cv: ["video/mp4", "video/webm"],
  attachment: ["application/pdf", "image/png", "image/jpeg", "text/plain"],
  avatar: ["image/png", "image/jpeg", "image/webp"],
  logo: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
};

async function settingInt(key: string, fallback: number): Promise<number> {
  const rows = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
  const value = rows[0] ? parseInt(rows[0].value, 10) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

export async function maxUploadBytes(purpose: UploadPurpose): Promise<number> {
  if (purpose === "video_cv") {
    const mb = await settingInt("video_max_size_mb", 50);
    return mb * 1024 * 1024;
  }
  if (purpose === "resume" || purpose === "attachment") return 10 * 1024 * 1024;
  return 5 * 1024 * 1024;
}

export async function maxVideoDurationSeconds(): Promise<number> {
  return settingInt("video_max_duration_seconds", 120);
}

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("base64url");
}

export function signUploadToken(payload: { key: string; size: number; userId: string; purpose: UploadPurpose; exp: number }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyUploadToken(token: string): { key: string; size: number; userId: string; purpose: UploadPurpose; exp: number } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed.key || !parsed.userId || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function validateUpload(purpose: UploadPurpose, contentType: string, size: number, maxBytes: number): string | null {
  if (!ALLOWED_MIME[purpose].includes(contentType)) {
    return `File type "${contentType}" is not allowed. Accepted: ${ALLOWED_MIME[purpose].join(", ")}`;
  }
  if (!Number.isFinite(size) || size <= 0) return "File is empty";
  if (size > maxBytes) return `File exceeds the ${(maxBytes / 1024 / 1024).toFixed(0)} MB limit`;
  return null;
}

export function buildKey(userId: string, purpose: UploadPurpose, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  return `${purpose}s/${userId}/${crypto.randomUUID()}-${safe}`;
}

async function r2Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export type PresignResult =
  | { mode: "r2"; url: string; key: string }
  | { mode: "local"; url: string; key: string };

export async function presignUpload(args: {
  userId: string;
  purpose: UploadPurpose;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<PresignResult | { error: string }> {
  const maxBytes = await maxUploadBytes(args.purpose);
  const invalid = validateUpload(args.purpose, args.contentType, args.size, maxBytes);
  if (invalid) return { error: invalid };

  const key = buildKey(args.userId, args.purpose, args.fileName);

  if (r2Configured()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await r2Client();
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        ContentType: args.contentType,
        ContentLength: args.size,
      }),
      { expiresIn: 300 }
    );
    return { mode: "r2", url, key };
  }

  const token = signUploadToken({
    key,
    size: args.size,
    userId: args.userId,
    purpose: args.purpose,
    exp: Date.now() + 5 * 60 * 1000,
  });
  return { mode: "local", url: `/api/uploads/local?token=${encodeURIComponent(token)}`, key };
}

/* ------------------------------ Local storage ------------------------------ */

export function localPathForKey(key: string): string {
  const resolved = path.resolve(STORAGE_DIR, key);
  if (!resolved.startsWith(path.resolve(STORAGE_DIR))) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export async function writeLocalFile(key: string, data: Buffer) {
  const target = localPathForKey(key);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, data);
}

export async function readLocalFile(key: string): Promise<Buffer | null> {
  try {
    return await fs.promises.readFile(localPathForKey(key));
  } catch {
    return null;
  }
}

export async function deleteLocalFile(key: string) {
  try {
    await fs.promises.unlink(localPathForKey(key));
  } catch {
    /* already gone */
  }
}

export async function localFileExists(key: string): Promise<boolean> {
  try {
    await fs.promises.access(localPathForKey(key));
    return true;
  } catch {
    return false;
  }
}

export async function contentLengthLocal(key: string): Promise<number | null> {
  try {
    const stat = await fs.promises.stat(localPathForKey(key));
    return stat.size;
  } catch {
    return null;
  }
}
