import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { JobModerationControls } from "@/components/admin-components";
import { Badge, Card, PageHeader, STATUS_TONES } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job moderation" };

export default async function AdminJobsPage() {
  await requireRole("admin", "super_admin");
  const rows = await db
    .select({ job: jobs, company: companies })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .orderBy(desc(jobs.flagged), desc(jobs.createdAt))
    .limit(60);

  return (
    <DashboardShell active="/dashboard/admin/jobs">
      <PageHeader title="Job moderation" subtitle="Flagged jobs surface first. Force-closing notifies the employer." />
      <Card>
        <div className="divide-y divide-gray-100">
          {rows.map(({ job, company }) => (
            <div key={job.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/jobs/${job.id}`} className="font-bold text-brand-950 hover:text-brand-600">{job.title}</Link>
                  <Badge tone={STATUS_TONES[job.status]}>{job.status}</Badge>
                  {job.flagged && <Badge tone="red">flagged</Badge>}
                  {!company.verified && <Badge tone="amber">unverified company</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{company.name} · {job.location} · {timeAgo(job.createdAt)}</p>
              </div>
              <JobModerationControls jobId={job.id} flagged={job.flagged} status={job.status} />
            </div>
          ))}
          {rows.length === 0 && <p className="p-8 text-center text-sm text-gray-400">No job posts yet.</p>}
        </div>
      </Card>
    </DashboardShell>
  );
}
