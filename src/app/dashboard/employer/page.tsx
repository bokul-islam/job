import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Building2, Clock3, FileText, Inbox, Newspaper, PlusCircle, Users2, Zap } from "lucide-react";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolvePlan } from "@/lib/entitlements";
import { employerDashboard, employerProfileFor, getResponseStatsFor, companyProfileCompletion } from "@/lib/queries";
import { DashboardShell } from "@/components/dashboard-shell";
import { MiniBarChart, StatusDonut } from "@/components/charts";
import { Alert, Badge, Card, CardHeader, LinkButton, PageHeader, Progress, Stat } from "@/components/ui";
import { formatDuration, timeAgo, APPLICATION_STATUS_LABELS } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Employer dashboard" };

export default async function EmployerDashboardPage() {
  const user = await requireRole("employer");
  const employer = await employerProfileFor(user.id);
  const [stats, response, planInfo, activity, completion] = await Promise.all([
    employerDashboard(user.id),
    getResponseStatsFor(user.id),
    resolvePlan(user),
    db.select().from(activityLogs).where(eq(activityLogs.userId, user.id)).orderBy(desc(activityLogs.createdAt)).limit(8),
    companyProfileCompletion(employer?.company?.id ?? null),
  ]);

  const donutData = stats.byStatus.map((s) => ({ name: APPLICATION_STATUS_LABELS[s.status] ?? s.status, value: s.count }));
  const weeklyData = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
    (day) => ({ name: day, value: stats.weekly.find((w) => w.day === day || w.day.startsWith(day.slice(0, 3)))?.count ?? 0 })
  );

  return (
    <DashboardShell active="/dashboard/employer">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle={employer?.company ? `Hiring workspace for ${employer.company.name}` : "Set up your company to start hiring"}
        actions={<LinkButton href="/dashboard/employer/jobs/new"><PlusCircle className="h-4 w-4" /> Post a job</LinkButton>}
      />

      {!employer?.company && (
        <div className="mb-6">
          <Alert tone="warning">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>You need a company profile before you can publish jobs.</span>
              <LinkButton href="/dashboard/employer/company" size="sm" variant="outline">Set up company</LinkButton>
            </div>
          </Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active job posts" value={stats.jobs.active} icon={<Newspaper className="h-4 w-4" />} sub={`${stats.jobs.total} total · limit ${planInfo.limits.activeJobPosts}`} />
        <Stat label="Applications" value={stats.applications.total} icon={<FileText className="h-4 w-4" />} tone="teal" sub={`${stats.applications.fresh} new to review`} />
        <Stat label="Shortlisted" value={stats.applications.shortlisted} icon={<Users2 className="h-4 w-4" />} tone="purple" />
        <Stat label="Response rate" value={`${response.overall.responseRate}%`} icon={<Zap className="h-4 w-4" />} tone="amber" sub={response.overall.unanswered > 0 ? `${response.overall.unanswered} candidate(s) waiting` : "all caught up"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Company profile" action={<Badge tone={completion >= 70 ? "teal" : "amber"}>{completion}%</Badge>} />
          <div className="p-5">
            <Progress value={completion} />
            <p className="mt-3 text-xs text-gray-500">Verified, complete company pages attract better candidates.</p>
            <LinkButton href="/dashboard/employer/company" variant="secondary" size="sm" className="mt-4">
              <Building2 className="h-3.5 w-3.5" /> Edit company
            </LinkButton>
          </div>
        </Card>

        <StatusDonut title="Applicant funnel" data={donutData} />
        <MiniBarChart title="Applications — last 7 days" data={weeklyData} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your responsiveness" subtitle="Shown publicly on your job posts" />
          <div className="space-y-2.5 p-5 text-sm">
            <Line label="Average response time" value={formatDuration(response.overall.avgSeconds)} />
            <Line label="Median response time" value={formatDuration(response.overall.medianSeconds)} />
            <Line label="Business-hours average" value={formatDuration(response.business.avgSeconds)} />
            <Line label="Messages answered" value={`${response.overall.totalAnswered}/${response.overall.totalReceived}`} />
            <Line label="Currently unanswered" value={String(response.overall.unanswered)} />
            <Link href="/inbox" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-accent-600 hover:text-accent-700">
              <Inbox className="h-3.5 w-3.5" /> Reply in inbox
            </Link>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Subscription"
            action={<Badge tone={planInfo.subscriptionStatus === "active" ? "green" : "gray"}>{planInfo.plan?.name ?? "Free"}</Badge>}
          />
          <div className="p-5 text-sm text-gray-600">
            <p>{planInfo.limits.activeJobPosts} active job post(s) · {planInfo.limits.messagesPerDay} messages/day · {planInfo.limits.candidateSearchesPerDay} candidate searches/day</p>
            <div className="mt-4 flex gap-2">
              <LinkButton href="/pricing" variant="outline" size="sm">Upgrade</LinkButton>
              <LinkButton href="/dashboard/billing" variant="ghost" size="sm">Billing history</LinkButton>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent recruitment activity" />
        <div className="divide-y divide-gray-50">
          {activity.length === 0 && <p className="p-5 text-sm text-gray-400">Post your first job to get started.</p>}
          {activity.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Clock3 className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold capitalize text-gray-800">{a.action.replace(/[._]/g, " ")}</p>
                <p className="text-[11px] text-gray-400">{timeAgo(a.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </DashboardShell>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold text-brand-900">{value}</span>
    </div>
  );
}
