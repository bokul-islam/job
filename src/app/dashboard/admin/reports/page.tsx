import { desc, eq } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { reports, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { ReportResolver } from "@/components/admin-components";
import { Badge, Card, EmptyState, PageHeader, STATUS_TONES } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function AdminReportsPage() {
  await requireRole("admin", "super_admin");
  const rows = await db
    .select({ report: reports, reporter: users })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .orderBy(desc(reports.createdAt))
    .limit(60);

  const open = rows.filter((r) => r.report.status === "open" || r.report.status === "reviewing");
  const closed = rows.filter((r) => !open.includes(r));

  return (
    <DashboardShell active="/dashboard/admin/reports">
      <PageHeader title="Reported content" subtitle="User-submitted moderation queue" />
      {rows.length === 0 ? (
        <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="No reports" body="Reports from users (jobs, users, messages, companies) will appear here." />
      ) : (
        <div className="space-y-4">
          {[...open, ...closed].map(({ report, reporter }) => (
            <Card key={report.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONES[report.status] ?? "gray"}>{report.status}</Badge>
                    <Badge tone="navy">{report.targetType}</Badge>
                    <p className="text-sm font-bold text-gray-900">{report.reason}</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    reported by {reporter.name} ({reporter.email}) · {timeAgo(report.createdAt)} · target <span className="font-mono text-[10px]">{report.targetId}</span>
                  </p>
                  {report.details && <p className="mt-2 rounded-xl bg-[#f8fafd] px-4 py-3 text-xs text-gray-600">{report.details}</p>}
                </div>
              </div>
              <ReportResolver report={report} />
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
