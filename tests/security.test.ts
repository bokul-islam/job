import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, randomToken, sha256 } from "@/lib/passwords";
import { registerSchema, jobSchema, messageSchema } from "@/lib/validators";
import { jobTypeEnum } from "@/db/schema";

describe("password hashing (scrypt)", () => {
  it("round-trips correctly and uses a random salt", () => {
    const a = hashPassword("SecretA1");
    const b = hashPassword("SecretA1");
    expect(a).not.toBe(b); // different salts
    expect(verifyPassword("SecretA1", a)).toBe(true);
    expect(verifyPassword("SecretA1", b)).toBe(true);
    expect(verifyPassword("WrongPass1", a)).toBe(false);
  });

  it("rejects malformed hashes without throwing", () => {
    expect(verifyPassword("anything1", "not-a-hash")).toBe(false);
  });
});

describe("tokens", () => {
  it("randomToken is unique and url-safe", () => {
    const t1 = randomToken();
    const t2 = randomToken();
    expect(t1).not.toBe(t2);
    expect(t1).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sha256(t1)).toHaveLength(64);
  });
});

describe("validators", () => {
  it("registerSchema rejects weak passwords and missing terms", () => {
    const bad = registerSchema.safeParse({ name: "A", email: "not-an-email", password: "short", role: "job_seeker", acceptTerms: false });
    expect(bad.success).toBe(false);
  });

  it("registerSchema accepts a valid employer", () => {
    const ok = registerSchema.safeParse({
      name: "Farhana Akter", email: "f@acme.dev", password: "Passw0rd9", role: "employer", companyName: "Acme", acceptTerms: true,
    });
    expect(ok.success).toBe(true);
  });

  it("jobSchema requires a real description", () => {
    const bad = jobSchema.safeParse({ title: "Dev", location: "Dhaka", jobType: "full_time", workplaceType: "remote", experienceLevel: "mid", description: "too short", vacancies: 1, action: "publish" });
    expect(bad.success).toBe(false);
    const good = jobSchema.safeParse({
      title: "React Developer", location: "Dhaka", jobType: "full_time", workplaceType: "remote", experienceLevel: "mid",
      description: "A sufficiently long description of the role and its expectations.", vacancies: 2, action: "draft",
    });
    expect(good.success).toBe(true);
  });

  it("messageSchema rejects empty and oversized messages", () => {
    expect(messageSchema.safeParse({ conversationId: crypto.randomUUID(), body: "" }).success).toBe(false);
    expect(messageSchema.safeParse({ conversationId: crypto.randomUUID(), body: "x".repeat(4001) }).success).toBe(false);
    expect(messageSchema.safeParse({ conversationId: crypto.randomUUID(), body: "Hello!" }).success).toBe(true);
  });

  it("jobType enum matches schema options", () => {
    for (const t of jobTypeEnum.enumValues) {
      expect(jobSchema.shape.jobType.safeParse(t).success).toBe(true);
    }
  });
});
