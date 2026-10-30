import "dotenv/config";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/passwords";

function strong() {
  return crypto.randomBytes(9).toString("base64url");
}

async function main() {
  const targets: string[] = ["nabila.dev@example.com", "farhana@airtech.dev", "admin@talentbridge.dev"];
  const out: Record<string, string> = {};
  for (const email of targets) {
    const pw = strong();
    await db.update(users).set({ passwordHash: hashPassword(pw) }).where(eq(users.email, email));
    out[email] = pw;
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}
main();
