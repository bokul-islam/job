import { describe, expect, it } from "vitest";
import { businessSecondsBetween, computeResponseStats, type ResponseEventLike } from "@/lib/metrics";

function ev(receivedMinutesAgo: number, answeredSeconds: number | null): ResponseEventLike {
  const now = Date.now();
  const receivedAt = new Date(now - receivedMinutesAgo * 60_000);
  return {
    receivedAt,
    answeredAt: answeredSeconds != null ? new Date(receivedAt.getTime() + answeredSeconds * 1000) : null,
    responseSeconds: answeredSeconds,
  };
}

describe("computeResponseStats", () => {
  it("computes average, median, rate for answered events", () => {
    const stats = computeResponseStats([ev(120, 7200), ev(100, 1800), ev(80, 3600)]);
    expect(stats.totalReceived).toBe(3);
    expect(stats.totalAnswered).toBe(3);
    expect(stats.unanswered).toBe(0);
    expect(stats.responseRate).toBe(100);
    expect(stats.avgSeconds).toBe(4200); // (7200+1800+3600)/3
    expect(stats.medianSeconds).toBe(3600);
    expect(stats.fastestSeconds).toBe(1800);
    expect(stats.slowestSeconds).toBe(7200);
  });

  it("tracks unanswered messages separately, not as zero-second responses", () => {
    const stats = computeResponseStats([ev(120, 3600), ev(10, null)]);
    expect(stats.totalReceived).toBe(2);
    expect(stats.totalAnswered).toBe(1);
    expect(stats.unanswered).toBe(1);
    expect(stats.responseRate).toBe(50);
    expect(stats.avgSeconds).toBe(3600);
  });

  it("returns null-friendly stats for empty history", () => {
    const stats = computeResponseStats([]);
    expect(stats.responseRate).toBe(100);
    expect(stats.avgSeconds).toBeNull();
    expect(stats.medianSeconds).toBeNull();
  });

  it("computes median for even counts", () => {
    const stats = computeResponseStats([ev(1, 100), ev(1, 300), ev(1, 500), ev(1, 900)]);
    expect(stats.medianSeconds).toBe(400);
  });
});

describe("businessSecondsBetween", () => {
  it("counts only Mon–Fri 09:00–18:00", () => {
    const friday = new Date("2026-02-06T17:30:00"); // Friday
    const monday = new Date("2026-02-09T10:00:00"); // Monday
    // 30 min Friday + 1 hour Monday = 5400s
    expect(businessSecondsBetween(friday, monday)).toBe(5400);
  });

  it("is zero outside business hours", () => {
    const night = new Date("2026-02-04T22:00:00");
    const nextMorning = new Date("2026-02-05T08:00:00");
    expect(businessSecondsBetween(night, nextMorning)).toBe(0);
  });

  it("clamps partial-day overlap", () => {
    const from = new Date("2026-02-04T10:00:00");
    const to = new Date("2026-02-04T12:30:00");
    expect(businessSecondsBetween(from, to)).toBe(9000);
  });
});
