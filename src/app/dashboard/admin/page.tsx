import { desc, eq } from "drizzle-orm";
import { Briefcase, CreditCard, FileText, ShieldAlert, Users } from "lucide-react";
import { db } from "@/db";
import { activityLogs, reports } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { adminOverview } from "@/lib/queries";
import { revenueSummary } from "@/lib/payments";
import { DashboardShell } from "@/components/dashboard-shell";
import { GrowthLine } from "@/components/charts";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { formatMoney, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  await requireRole("admin", "super_admin");
  const [overview, revenue, openReports, recent] = await Promise.all([
    adminOverview(),
    revenueSummary(),
    db.select().from(reports).where(eq(reports.status, "open")),
    db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(12),
  ]);

  return (
    <DashboardShell active="/dashboard/admin">
      <PageHeader title="Platform overview" subtitle="Live values from the production database — nothing hardcoded." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total users" value={overview.users.total} icon={<Users className="h-4 w-4" />} sub={`${overview.users.seekers} job seekers · ${overview.users.employers} employers`} />
        <Stat label="Job posts" value={overview.jobs.total} icon={<Briefcase className="h-4 w-4" />} tone="teal" sub={`${overview.jobs.active} currently active`} />
        <Stat label="Applications" value={overview.applicationsTotal} icon={<FileText className="h-4 w-4" />} tone="purple" />
        <Stat label="Active subscriptions" value={overview.activeSubscriptions} icon={<CreditCard className="h-4 w-4" />} tone="amber" sub={`${formatMoney(revenue.total)} recorded revenue (${revenue.count} payments)`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <GrowthLine title="User growth" data={overview.growth} />
        <Card>
          <CardHeader
            title="Open reports"
            subtitle={`${openReports.length} awaiting moderation`}
          />
          <div className="max-h-60 divide-y divide-gray-50 overflow-y-auto">
            {openReports.length === 0 && <p className="p-5 text-sm text-gray-400">No open reports. Nice.</p>}
            {openReports.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-800">{r.reason} <span className="font-normal text-gray-400">({r.targetType})</span></p>
                  <p className="text-[11px] text-gray-400">{timeAgo(r.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent platform activity" />
        <div className="grid gap-x-8 divide-y divide-gray-50 md:grid-cols-2 md:divide-y-0">
          {[recent.slice(0, 6), recent.slice(6, 12)].map((col, i) => (
            <div key={i} className="divide-y divide-gray-50">
              {col.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-2.5">
                  <p className="truncate text-xs font-medium capitalize text-gray-700">{a.action.replace(/[._]/g, " ")}</p>
                  <p className="shrink-0 pl-3 text-[11px] text-gray-400">{timeAgo(a.createdAt)}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </DashboardShell>
  );
}
