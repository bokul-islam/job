import crypto from "node:crypto";

/** Pure payment helpers — safe for scripts and tests. */

export function computePeriodEnd(interval: "monthly" | "yearly", from: Date = new Date()): Date {
  const end = new Date(from);
  if (interval === "monthly") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}

export function hmacSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function timingSafeVerify(payload: string, signature: string, secret: string): boolean {
  const expected = hmacSignature(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
