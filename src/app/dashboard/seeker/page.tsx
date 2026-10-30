import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bookmark, Briefcase, Clock3, FileText, TrendingUp, Zap } from "lucide-react";
import { db } from "@/db";
import { activityLogs, membershipPlans } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolvePlan } from "@/lib/entitlements";
import { getResponseStatsFor, seekerDashboard, seekerProfileFor } from "@/lib/queries";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusDonut } from "@/components/charts";
import { Badge, Card, CardHeader, LinkButton, PageHeader, Progress, Stat } from "@/components/ui";
import { formatDuration, timeAgo, APPLICATION_STATUS_LABELS } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function SeekerDashboardPage() {
  const user = await requireRole("job_seeker");
  const [profile, stats, response, planInfo, activity] = await Promise.all([
    seekerProfileFor(user.id),
    seekerDashboard(user.id),
    getResponseStatsFor(user.id),
    resolvePlan(user),
    db.select().from(activityLogs).where(eq(activityLogs.userId, user.id)).orderBy(desc(activityLogs.createdAt)).limit(8),
  ]);

  const chartData = stats.byStatus.map((s) => ({ name: APPLICATION_STATUS_LABELS[s.status] ?? s.status, value: s.count }));

  return (
    <DashboardShell active="/dashboard/seeker">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle="Your job search at a glance — everything below comes from live database records."
        actions={<LinkButton href="/jobs">Find a Job</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Applications" value={stats.applications.total} icon={<FileText className="h-4 w-4" />} sub={`${stats.applications.pending} awaiting employer`} />
        <Stat label="Shortlisted" value={stats.applications.shortlisted} icon={<TrendingUp className="h-4 w-4" />} tone="purple" sub={`${stats.applications.hired} hired`} />
        <Stat label="Saved jobs" value={stats.savedCount} icon={<Bookmark className="h-4 w-4" />} tone="teal" />
        <Stat label="Response rate" value={`${response.overall.responseRate}%`} icon={<Zap className="h-4 w-4" />} tone="amber" sub={response.overall.unanswered > 0 ? `${response.overall.unanswered} message(s) awaiting your reply` : "all caught up"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Profile strength" action={<Badge tone={profile && profile.completionPct >= 70 ? "teal" : "amber"}>{profile?.completionPct ?? 0}%</Badge>} />
          <div className="p-5">
            <Progress value={profile?.completionPct ?? 0} />
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Complete profiles get more employer views. Add your headline, skills, experience and a resume to reach 100%.
            </p>
            <LinkButton href="/dashboard/seeker/profile" variant="secondary" size="sm" className="mt-4">Complete profile</LinkButton>
          </div>
        </Card>

        <StatusDonut title="Application funnel" data={chartData} />

        <Card>
          <CardHeader title="Your responsiveness" subtitle="Calendar time · business hours available in metrics" />
          <div className="space-y-2.5 p-5 text-sm">
            <Line label="Average response time" value={formatDuration(response.overall.avgSeconds)} />
            <Line label="Median response time" value={formatDuration(response.overall.medianSeconds)} />
            <Line label="Business-hours average" value={formatDuration(response.business.avgSeconds)} />
            <Line label="Fastest reply" value={formatDuration(response.overall.fastestSeconds)} />
            <Line label="Messages answered" value={`${response.overall.totalAnswered}/${response.overall.totalReceived}`} />
            <Link href="/inbox" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-accent-600 hover:text-accent-700">
              <Clock3 className="h-3.5 w-3.5" /> Open inbox
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Membership" subtitle="Plan limits are enforced on the server" />
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-extrabold text-brand-950">{planInfo.plan?.name ?? "Free"} plan</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {planInfo.limits.applicationsPerMonth} applications/month · {planInfo.limits.messagesPerDay} messages/day
                  {planInfo.limits.videoCvAllowed ? " · video CV enabled" : ""}
                </p>
              </div>
              <Badge tone={planInfo.subscriptionStatus === "active" ? "green" : "gray"}>
                {planInfo.subscriptionStatus === "active" ? "Active" : "Free"}
              </Badge>
            </div>
            <div className="mt-4 flex gap-2">
              <LinkButton href="/pricing" variant="outline" size="sm">Upgrade</LinkButton>
              <LinkButton href="/dashboard/billing" variant="ghost" size="sm">Billing history</LinkButton>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          <div className="divide-y divide-gray-50">
            {activity.length === 0 && <p className="p-5 text-sm text-gray-400">Your activity will appear here.</p>}
            {activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Briefcase className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-800">{a.action.replace(/[._]/g, " ")}</p>
                  <p className="text-[11px] text-gray-400">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
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
