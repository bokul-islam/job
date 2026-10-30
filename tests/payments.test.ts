import { describe, expect, it } from "vitest";
import { hmacSignature, timingSafeVerify, computePeriodEnd } from "@/lib/payments-core";

describe("payment webhook signature verification", () => {
  const secret = "test-secret";
  const payload = JSON.stringify({ eventId: "evt_1", type: "payment.completed", data: { paymentId: "p_1" } });

  it("accepts a valid signature", () => {
    const sig = hmacSignature(payload, secret);
    expect(timingSafeVerify(payload, sig, secret)).toBe(true);
  });

  it("rejects tampered payloads and wrong secrets", () => {
    const sig = hmacSignature(payload, secret);
    expect(timingSafeVerify(payload + " ", sig, secret)).toBe(false);
    expect(timingSafeVerify(payload, sig, "other-secret")).toBe(false);
    expect(timingSafeVerify(payload, "", secret)).toBe(false);
  });
});

describe("computePeriodEnd", () => {
  it("adds a month for monthly subscriptions", () => {
    const from = new Date("2026-01-15T10:00:00Z");
    expect(computePeriodEnd("monthly", from).getMonth()).toBe(1);
  });
  it("adds a year for yearly subscriptions", () => {
    const from = new Date("2026-01-15T10:00:00Z");
    expect(computePeriodEnd("yearly", from).getFullYear()).toBe(2027);
  });
});
