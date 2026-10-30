/**
 * Pure response-time statistics. No I/O — fully unit-testable.
 *
 * Semantics:
 *  - A "response event" is an obligation created when a participant receives a
 *    message from the other participant (a run of consecutive messages from the
 *    same sender creates a single obligation).
 *  - An obligation is "answered" when the obligated user next sends a message.
 *  - Automated/system messages never create or answer obligations.
 */

export type ResponseEventLike = {
  receivedAt: Date;
  answeredAt: Date | null;
  responseSeconds: number | null;
};

export type ResponseStats = {
  totalReceived: number;
  totalAnswered: number;
  unanswered: number;
  responseRate: number; // 0-100
  avgSeconds: number | null;
  medianSeconds: number | null;
  fastestSeconds: number | null;
  slowestSeconds: number | null;
};

export function computeResponseStats(events: ResponseEventLike[]): ResponseStats {
  const answered = events.filter((e) => e.answeredAt != null && e.responseSeconds != null);
  const times = answered.map((e) => e.responseSeconds as number).sort((a, b) => a - b);
  const total = events.length;
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const median = times.length
    ? times.length % 2 === 1
      ? times[(times.length - 1) / 2]
      : Math.round((times[times.length / 2 - 1] + times[times.length / 2]) / 2)
    : null;
  return {
    totalReceived: total,
    totalAnswered: answered.length,
    unanswered: total - answered.length,
    responseRate: total === 0 ? 100 : Math.round((answered.length / total) * 100),
    avgSeconds: avg,
    medianSeconds: median,
    fastestSeconds: times.length ? times[0] : null,
    slowestSeconds: times.length ? times[times.length - 1] : null,
  };
}

/** Business-hours metric (Mon–Fri 09:00–18:00 local): seconds elapsed between two timestamps. */
export function businessSecondsBetween(from: Date, to: Date): number {
  const BUSINESS_START = 9;
  const BUSINESS_END = 18;
  let cursor = new Date(from);
  let total = 0;
  while (cursor < to) {
    const day = cursor.getDay();
    const isBusinessDay = day >= 1 && day <= 5;
    const dayEnd = new Date(cursor);
    dayEnd.setHours(BUSINESS_END, 0, 0, 0);
    const dayStart = new Date(cursor);
    dayStart.setHours(BUSINESS_START, 0, 0, 0);

    let segmentEnd = new Date(Math.min(to.getTime(), dayEnd.getTime(), cursor.getTime() + 24 * 3600 * 1000));
    if (isBusinessDay && cursor < dayEnd && to > dayStart) {
      const segStart = new Date(Math.max(cursor.getTime(), dayStart.getTime()));
      segmentEnd = new Date(Math.min(to.getTime(), dayEnd.getTime()));
      if (segmentEnd > segStart) total += (segmentEnd.getTime() - segStart.getTime()) / 1000;
    }
    // advance to next business day start
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(BUSINESS_START, 0, 0, 0);
  }
  return Math.max(0, Math.round(total));
}

export function businessStats(events: ResponseEventLike[]): ResponseStats {
  const businessEvents = events.map((e) => {
    if (!e.answeredAt) return { ...e, responseSeconds: null };
    const secs = businessSecondsBetween(e.receivedAt, e.answeredAt);
    return { ...e, responseSeconds: secs };
  });
  return computeResponseStats(businessEvents);
}
