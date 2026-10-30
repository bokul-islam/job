import Link from "next/link";
import { and, desc, eq, gte, ilike, or, sql, ne } from "drizzle-orm";
import { Users } from "lucide-react";
import { db } from "@/db";
import { activityLogs, jobSeekerProfiles, jobSeekerSkills, skills, users, videoCvs } from "@/db/schema";
import { requireRole, assertVerified } from "@/lib/auth";
import { resolvePlan } from "@/lib/entitlements";
import { getResponseStatsFor } from "@/lib/queries";
import { logActivity } from "@/lib/logging";
import { DashboardShell } from "@/components/dashboard-shell";
import { MessageComposer } from "@/components/start-conversation";
import { Alert, Avatar, Badge, Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { formatDuration, formatMoney, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find candidates" };

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireRole("employer");
  assertVerified(user);
  const { plan, limits } = await resolvePlan(user);

  const q = sp.q?.trim() ?? "";
  const location = sp.location?.trim() ?? "";
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = 9;
  const searched = Boolean(q || location || sp.page);

  // Plan-gated: each search counts against the daily allowance (recorded via activity log)
  let limited = false;
  let usedToday = 0;
  if (searched) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(activityLogs)
      .where(and(eq(activityLogs.userId, user.id), eq(activityLogs.action, "candidate.search"), gte(activityLogs.createdAt, start)));
    usedToday = row?.count ?? 0;
    if (usedToday >= limits.candidateSearchesPerDay) {
      limited = true;
    } else {
      await logActivity(user.id, "candidate.search");
      usedToday += 1;
    }
  }

  let results: { user: typeof users.$inferSelect; profile: typeof jobSeekerProfiles.$inferSelect }[] = [];
  let total = 0;

  const conditions = [
    eq(users.role, "job_seeker"),
    eq(users.status, "active"),
    ne(jobSeekerProfiles.visibility, "private"),
  ];
  if (q) {
    const pattern = `%${q}%`;
    const textMatch = or(
      ilike(users.name, pattern),
      ilike(jobSeekerProfiles.headline, pattern),
      ilike(jobSeekerProfiles.currentTitle, pattern),
      ilike(jobSeekerProfiles.bio, pattern)
    );
    if (textMatch) conditions.push(textMatch);
  }
  if (location) conditions.push(ilike(jobSeekerProfiles.location, `%${location}%`));

  const where = and(...conditions);
  if (!limited) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobSeekerProfiles)
      .innerJoin(users, eq(users.id, jobSeekerProfiles.userId))
      .where(where);
    total = countRow?.count ?? 0;

    results = await db
      .select({ user: users, profile: jobSeekerProfiles })
      .from(jobSeekerProfiles)
      .innerJoin(users, eq(users.id, jobSeekerProfiles.userId))
      .where(where)
      .orderBy(desc(jobSeekerProfiles.completionPct), desc(users.lastActiveAt))
      .limit(perPage)
      .offset((page - 1) * perPage);
  }

  const idList = results.map((r) => r.profile.id);
  const [skillRows, vids] = idList.length
    ? await Promise.all([
        db
          .select({ seekerId: jobSeekerSkills.seekerId, name: skills.name })
          .from(jobSeekerSkills)
          .innerJoin(skills, eq(skills.id, jobSeekerSkills.skillId))
          .where(sql`${jobSeekerSkills.seekerId} in (${sql.join(idList.map((id) => sql`${id}`), sql`, `)})`),
        db.select({ seekerId: videoCvs.seekerId }).from(videoCvs).where(eq(videoCvs.status, "ready")),
      ])
    : [[], []];

  const statsPerUser = new Map<string, Awaited<ReturnType<typeof getResponseStatsFor>>>();
  for (const r of results.slice(0, perPage)) {
    statsPerUser.set(r.user.id, await getResponseStatsFor(r.user.id));
  }

  return (
    <DashboardShell active="/dashboard/employer/candidates">
      <PageHeader
        title="Find candidates"
        subtitle={`${usedToday}/${limits.candidateSearchesPerDay} searches used today on your ${plan?.name ?? "Free"} plan`}
      />

      <Card className="mb-5 p-4">
        <form className="grid gap-3 md:grid-cols-[2fr,1.5fr,auto]">
          <Input name="q" defaultValue={q} placeholder="Name, headline, title, keyword…" />
          <Input name="location" defaultValue={location} placeholder="Location" />
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {limited && (
        <Alert tone="warning">
          Daily candidate-search allowance reached ({limits.candidateSearchesPerDay}/day on the {plan?.name ?? "Free"} plan).{" "}
          <Link href="/pricing" className="font-bold underline">Upgrade</Link> for more.
        </Alert>
      )}

      {!limited && results.length === 0 && (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No candidates found" body="Try different keywords or check back as new candidates join." />
      )}

      {!limited && results.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map(({ user: seeker, profile }) => {
              const s = statsPerUser.get(seeker.id);
              const mySkills = skillRows.filter((k) => k.seekerId === profile.id).map((k) => k.name).slice(0, 5);
              const hasVideo = vids.some((v) => v.seekerId === profile.id);
              return (
                <Card key={seeker.id} className="flex flex-col p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={seeker.name} />
                    <div className="min-w-0">
                      <Link href={`/candidates/${seeker.id}`} className="font-bold text-brand-950 hover:text-brand-600">{seeker.name}</Link>
                      <p className="truncate text-xs text-gray-500">{profile.headline ?? profile.currentTitle ?? "Job seeker"}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">{profile.location ?? "Location hidden"} · active {timeAgo(seeker.lastActiveAt)}</p>
                    </div>
                  </div>
                  {(profile.expectedSalaryMin || profile.expectedSalaryMax) && (
                    <p className="mt-2 text-xs font-semibold text-brand-800">
                      {formatMoney(profile.expectedSalaryMin ?? 0)}–{formatMoney(profile.expectedSalaryMax ?? 0)} /mo expected
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {mySkills.map((s) => <Badge key={s} tone="navy">{s}</Badge>)}
                    {hasVideo && <Badge tone="teal">Video CV</Badge>}
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-500">
                    {s && s.overall.totalReceived > 0 ? (
                      <span>replies in {formatDuration(s.overall.avgSeconds)} · {s.overall.responseRate}% rate</span>
                    ) : (
                      <span>no messaging history yet</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2 pt-1">
                    <MessageComposer recipientId={seeker.id} recipientName={seeker.name} label="Message" />
                    <Link href={`/candidates/${seeker.id}`} className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-300">Profile</Link>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-gray-400">{total} candidates matched{total > perPage ? ` — page ${page} of ${Math.ceil(total / perPage)}` : ""}</p>
        </>
      )}
    </DashboardShell>
  );
}
