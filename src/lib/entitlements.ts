import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  applications,
  jobs,
  membershipPlans,
  messages,
  planEntitlements,
  subscriptions,
  type MembershipPlan,
  type PlanEntitlement,
  type User,
} from "@/db/schema";

export type Limits = {
  applicationsPerMonth: number;
  activeJobPosts: number;
  messagesPerDay: number;
  messagesPerConversationPerDay: number;
  videoCvAllowed: boolean;
  featuredCandidate: boolean;
  candidateSearchesPerDay: number;
  advancedAnalytics: boolean;
  featuredJobs: boolean;
};

const FREE_DEFAULTS: Record<"job_seeker" | "employer", Limits> = {
  job_seeker: {
    applicationsPerMonth: 10,
    activeJobPosts: 0,
    messagesPerDay: 10,
    messagesPerConversationPerDay: 5,
    videoCvAllowed: false,
    featuredCandidate: false,
    candidateSearchesPerDay: 0,
    advancedAnalytics: false,
    featuredJobs: false,
  },
  employer: {
    applicationsPerMonth: 0,
    activeJobPosts: 1,
    messagesPerDay: 10,
    messagesPerConversationPerDay: 5,
    videoCvAllowed: false,
    featuredCandidate: false,
    candidateSearchesPerDay: 10,
    advancedAnalytics: false,
    featuredJobs: false,
  },
};

export type ResolvedPlan = { plan: MembershipPlan | null; limits: Limits; subscriptionStatus: string | null };

export async function getActiveSubscription(userId: string) {
  const rows = await db
    .select({ sub: subscriptions, plan: membershipPlans })
    .from(subscriptions)
    .innerJoin(membershipPlans, eq(membershipPlans.id, subscriptions.planId))
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Automatic expiry handling
  if (row.sub.currentPeriodEnd && row.sub.currentPeriodEnd.getTime() < Date.now()) {
    await db
      .update(subscriptions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(subscriptions.id, row.sub.id));
    return null;
  }
  return row;
}

export async function getFreePlan(audience: "job_seeker" | "employer"): Promise<MembershipPlan | null> {
  const rows = await db
    .select()
    .from(membershipPlans)
    .where(
      and(
        eq(membershipPlans.audience, audience),
        eq(membershipPlans.priceMonthly, 0),
        eq(membershipPlans.isActive, true)
      )
    )
    .orderBy(membershipPlans.sortOrder)
    .limit(1);
  return rows[0] ?? null;
}

export async function resolvePlan(user: User): Promise<ResolvedPlan> {
  const audience = user.role === "employer" ? "employer" : "job_seeker";
  if (audience === "job_seeker" && user.role !== "job_seeker") {
    // admins: unconstrained
    return { plan: null, limits: { ...FREE_DEFAULTS.job_seeker, applicationsPerMonth: 999999, messagesPerDay: 999999 }, subscriptionStatus: "admin" };
  }
  const active = await getActiveSubscription(user.id);
  const plan = active?.plan ?? (await getFreePlan(audience));
  const limits = { ...FREE_DEFAULTS[audience] };
  if (plan) {
    const ents: PlanEntitlement[] = await db
      .select()
      .from(planEntitlements)
      .where(eq(planEntitlements.planId, plan.id));
    for (const e of ents) {
      applyEntitlement(limits, e);
    }
  }
  return { plan, limits, subscriptionStatus: active ? active.sub.status : null };
}

function applyEntitlement(limits: Limits, e: PlanEntitlement) {
  switch (e.key) {
    case "applications_per_month":
      if (e.valueInt != null) limits.applicationsPerMonth = e.valueInt;
      break;
    case "active_job_posts":
      if (e.valueInt != null) limits.activeJobPosts = e.valueInt;
      break;
    case "messages_per_day":
      if (e.valueInt != null) limits.messagesPerDay = e.valueInt;
      break;
    case "video_cv":
      limits.videoCvAllowed = e.valueBool === true;
      break;
    case "featured_candidate":
      limits.featuredCandidate = e.valueBool === true;
      break;
    case "candidate_searches_per_day":
      if (e.valueInt != null) limits.candidateSearchesPerDay = e.valueInt;
      break;
    case "advanced_analytics":
      limits.advancedAnalytics = e.valueBool === true;
      break;
    case "featured_jobs":
      limits.featuredJobs = e.valueBool === true;
      break;
  }
}

/* ------------------------------ Usage counters ------------------------------ */

export async function activeJobPostCount(employerId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.employerId, employerId), eq(jobs.status, "active")));
  return rows[0]?.count ?? 0;
}

export async function applicationsThisMonth(seekerId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(applications)
    .where(and(eq(applications.seekerId, seekerId), gte(applications.createdAt, start)));
  return rows[0]?.count ?? 0;
}

export async function messagesSentToday(userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.senderId, userId), gte(messages.createdAt, start)));
  return rows[0]?.count ?? 0;
}
