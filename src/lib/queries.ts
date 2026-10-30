import "server-only";
import {
  and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  applications, companies, conversationParticipants, conversations, employerProfiles,
  jobCategories, jobSeekerProfiles, jobs, messages, notifications, responseEvents,
  savedJobs, subscriptions, users,
} from "@/db/schema";
import { computeResponseStats, businessStats, type ResponseStats } from "@/lib/metrics";

/* --------------------------------- Job search -------------------------------- */

export type JobSearchParams = {
  q?: string;
  location?: string;
  categoryId?: string;
  jobType?: string;
  workplace?: string;
  experience?: string;
  minSalary?: number;
  maxSalary?: number;
  sort?: "newest" | "salary";
  page?: number;
  perPage?: number;
};

export async function searchJobs(params: JobSearchParams) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(25, Math.max(5, params.perPage ?? 10));

  const conditions: SQL[] = [eq(jobs.status, "active")];
  if (params.q) {
    const pattern = `%${params.q}%`;
    const match = or(ilike(jobs.title, pattern), ilike(jobs.description, pattern), ilike(companies.name, pattern));
    if (match) conditions.push(match);
  }
  if (params.location) conditions.push(ilike(jobs.location, `%${params.location}%`));
  if (params.categoryId) conditions.push(eq(jobs.categoryId, params.categoryId));
  if (params.jobType) conditions.push(eq(jobs.jobType, params.jobType as typeof jobs.jobType.enumValues[number]));
  if (params.workplace) conditions.push(eq(jobs.workplaceType, params.workplace as typeof jobs.workplaceType.enumValues[number]));
  if (params.experience) conditions.push(eq(jobs.experienceLevel, params.experience as typeof jobs.experienceLevel.enumValues[number]));
  if (params.minSalary) conditions.push(gte(jobs.salaryMax, params.minSalary));
  if (params.maxSalary) conditions.push(lte(jobs.salaryMin, params.maxSalary));

  const where = and(...conditions);
  const order = params.sort === "salary" ? desc(jobs.salaryMax) : desc(jobs.createdAt);

  const rows = await db
    .select({ job: jobs, company: companies, category: jobCategories })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId))
    .where(where)
    .orderBy(order)
    .limit(perPage)
    .offset((page - 1) * perPage);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(where);
  const total = countRows[0]?.count ?? 0;

  return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getJobWithCompany(jobId: string) {
  const rows = await db
    .select({ job: jobs, company: companies, category: jobCategories, employer: users })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId))
    .innerJoin(users, eq(users.id, jobs.employerId))
    .where(eq(jobs.id, jobId))
    .limit(1);
  return rows[0] ?? null;
}

export async function featuredJobs(limit = 6) {
  return db
    .select({ job: jobs, company: companies, category: jobCategories })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId))
    .where(eq(jobs.status, "active"))
    .orderBy(desc(jobs.featured), desc(jobs.createdAt))
    .limit(limit);
}

export async function categoryCounts() {
  return db
    .select({ category: jobCategories, count: sql<number>`count(${jobs.id})::int` })
    .from(jobCategories)
    .leftJoin(jobs, and(eq(jobs.categoryId, jobCategories.id), eq(jobs.status, "active")))
    .groupBy(jobCategories.id)
    .orderBy(desc(sql`count(${jobs.id})`));
}

/* ------------------------------ Response metrics ----------------------------- */

export async function getResponseStatsFor(userId: string): Promise<{ overall: ResponseStats; business: ResponseStats }> {
  const events = await db
    .select({
      receivedAt: responseEvents.receivedAt,
      answeredAt: responseEvents.answeredAt,
      responseSeconds: responseEvents.responseSeconds,
    })
    .from(responseEvents)
    .where(eq(responseEvents.obligatedUserId, userId));
  return { overall: computeResponseStats(events), business: businessStats(events) };
}

/* ------------------------------ Dashboard stats ------------------------------ */

export async function seekerDashboard(userId: string) {
  const [appRows] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${applications.status} in ('submitted','viewed'))::int`,
      shortlisted: sql<number>`count(*) filter (where ${applications.status} in ('shortlisted','interview'))::int`,
      hired: sql<number>`count(*) filter (where ${applications.status} = 'hired')::int`,
    })
    .from(applications)
    .where(eq(applications.seekerId, userId));
  const [savedRows] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(savedJobs)
    .where(eq(savedJobs.seekerId, userId));
  const [unreadRows] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  const byStatus = await db
    .select({ status: applications.status, count: sql<number>`count(*)::int` })
    .from(applications)
    .where(eq(applications.seekerId, userId))
    .groupBy(applications.status);

  return {
    applications: appRows ?? { total: 0, pending: 0, shortlisted: 0, hired: 0 },
    savedCount: savedRows?.count ?? 0,
    unreadNotifications: unreadRows?.count ?? 0,
    byStatus,
  };
}

export async function employerDashboard(userId: string) {
  const [jobRows] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${jobs.status} = 'active')::int`,
      paused: sql<number>`count(*) filter (where ${jobs.status} = 'paused')::int`,
      closed: sql<number>`count(*) filter (where ${jobs.status} = 'closed')::int`,
    })
    .from(jobs)
    .where(eq(jobs.employerId, userId));
  const [appRows] = await db
    .select({
      total: sql<number>`count(*)::int`,
      fresh: sql<number>`count(*) filter (where ${applications.status} = 'submitted')::int`,
      shortlisted: sql<number>`count(*) filter (where ${applications.status} in ('shortlisted','interview'))::int`,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(jobs.employerId, userId));
  const [unreadRows] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  const byStatus = await db
    .select({ status: applications.status, count: sql<number>`count(*)::int` })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(jobs.employerId, userId))
    .groupBy(applications.status);

  const weekly = await db
    .select({ day: sql<string>`to_char(${applications.createdAt}, 'Dy')`, count: sql<number>`count(*)::int` })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(jobs.employerId, userId), gte(applications.createdAt, new Date(Date.now() - 7 * 864e5))))
    .groupBy(sql`to_char(${applications.createdAt}, 'Dy')`);

  return {
    jobs: jobRows ?? { total: 0, active: 0, paused: 0, closed: 0 },
    applications: appRows ?? { total: 0, fresh: 0, shortlisted: 0 },
    unreadNotifications: unreadRows?.count ?? 0,
    byStatus,
    weekly,
  };
}

export async function adminOverview() {
  const [userRows] = await db
    .select({
      total: sql<number>`count(*)::int`,
      seekers: sql<number>`count(*) filter (where ${users.role} = 'job_seeker')::int`,
      employers: sql<number>`count(*) filter (where ${users.role} = 'employer')::int`,
    })
    .from(users);
  const [jobRows] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${jobs.status} = 'active')::int`,
    })
    .from(jobs);
  const [appRows] = await db.select({ count: sql<number>`count(*)::int` }).from(applications);
  const [subRows] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));

  // user registrations by month (last 6 months)
  const growth = await db
    .select({
      month: sql<string>`to_char(${users.createdAt}, 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
    })
    .from(users)
    .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${users.createdAt}, 'YYYY-MM')`)
    .limit(12);

  return {
    users: userRows ?? { total: 0, seekers: 0, employers: 0 },
    jobs: jobRows ?? { total: 0, active: 0 },
    applicationsTotal: appRows?.count ?? 0,
    activeSubscriptions: subRows?.count ?? 0,
    growth: growth.map((g) => ({ month: g.month, count: g.count })),
  };
}

/* ------------------------------- Inbox queries ------------------------------- */

export async function inboxFor(userId: string) {
  const rows = await db
    .select({
      conversation: conversations,
      participant: conversationParticipants,
    })
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
    .where(eq(conversationParticipants.userId, userId))
    .orderBy(desc(conversations.lastMessageAt));

  const result = [];
  for (const row of rows) {
    const others = await db
      .select({ user: users, participant: conversationParticipants })
      .from(conversationParticipants)
      .innerJoin(users, eq(users.id, conversationParticipants.userId))
      .where(
        and(
          eq(conversationParticipants.conversationId, row.conversation.id),
          sql`${conversationParticipants.userId} <> ${userId}`
        )
      )
      .limit(1);
    const [lastMsg] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, row.conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    const unreadConditions: SQL[] = [
      eq(messages.conversationId, row.conversation.id),
      sql`${messages.senderId} <> ${userId}`,
    ];
    if (row.participant.lastReadAt) unreadConditions.push(gte(messages.createdAt, row.participant.lastReadAt));
    const [unread] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(...unreadConditions));
    result.push({
      conversation: row.conversation,
      other: others[0]?.user ?? null,
      lastMessage: lastMsg ?? null,
      unread: unread === undefined ? 0 : unread.count,
      iBlockedThem: row.participant.blocked,
    });
  }
  return result;
}

export async function unreadMessageCount(userId: string): Promise<number> {
  const convRows = await db
    .select({ participant: conversationParticipants })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));
  let total = 0;
  for (const { participant } of convRows) {
    const conditions: SQL[] = [
      eq(messages.conversationId, participant.conversationId),
      sql`${messages.senderId} <> ${userId}`,
    ];
    if (participant.lastReadAt) conditions.push(gte(messages.createdAt, participant.lastReadAt));
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(...conditions));
    total += row?.count ?? 0;
  }
  return total;
}

export async function companyProfileCompletion(companyId: string | null): Promise<number> {
  if (!companyId) return 0;
  const rows = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  const c = rows[0];
  if (!c) return 0;
  const fields = [c.name, c.tagline, c.description, c.website, c.industry, c.size, c.location, c.logoKey];
  const filled = fields.filter((f) => f != null && f !== "").length;
  return Math.round((filled / fields.length) * 100);
}

export async function employerProfileFor(userId: string) {
  const rows = await db
    .select({ profile: employerProfiles, company: companies })
    .from(employerProfiles)
    .leftJoin(companies, eq(companies.id, employerProfiles.companyId))
    .where(eq(employerProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function seekerProfileFor(userId: string) {
  const rows = await db
    .select()
    .from(jobSeekerProfiles)
    .where(eq(jobSeekerProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}
