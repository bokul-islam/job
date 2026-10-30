import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db } from "@/db";
import { applications, applicationStatusHistory, companies, jobs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { withdrawApplicationAction } from "@/lib/actions/applications";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, Card, EmptyState, LinkButton, PageHeader, STATUS_TONES, Button } from "@/components/ui";
import { timeAgo, APPLICATION_STATUS_LABELS, JOB_TYPE_LABELS } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "My applications" };

export default async function SeekerApplicationsPage() {
  const user = await requireRole("job_seeker");

  const rows = await db
    .select({ application: applications, job: jobs, company: companies })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(applications.seekerId, user.id))
    .orderBy(desc(applications.createdAt));

  const histories = rows.length
    ? await db.select().from(applicationStatusHistory).orderBy(applicationStatusHistory.createdAt)
    : [];

  return (
    <DashboardShell active="/dashboard/seeker/applications">
      <PageHeader title="My applications" subtitle={`${rows.length} application${rows.length === 1 ? "" : "s"} — status changes notify you instantly.`} actions={<LinkButton href="/jobs" size="sm">Find more jobs</LinkButton>} />

      {rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No applications yet" body="Browse jobs and apply with your saved resume and a short cover letter." action={<LinkButton href="/jobs" variant="secondary">Browse jobs</LinkButton>} />
      ) : (
        <div className="space-y-4">
          {rows.map(({ application, job, company }) => {
            const history = histories.filter((h) => h.applicationId === application.id);
            const canWithdraw = !["hired", "rejected", "withdrawn"].includes(application.status);
            return (
              <Card key={application.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/jobs/${job.id}`} className="font-bold text-brand-950 hover:text-brand-600">{job.title}</Link>
                      <Badge tone={STATUS_TONES[application.status]}>{APPLICATION_STATUS_LABELS[application.status]}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">{company.name} · {job.location} · {JOB_TYPE_LABELS[job.jobType]} · applied {timeAgo(application.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canWithdraw && (
                      <form action={async () => { "use server"; await withdrawApplicationAction(application.id); }}>
                        <Button size="sm" variant="ghost" className="text-red-600" type="submit">Withdraw</Button>
                      </form>
                    )}
                  </div>
                </div>
                {application.coverLetter && (
                  <p className="mt-3 line-clamp-2 rounded-xl bg-[#f8fafd] px-4 py-3 text-xs text-gray-600">“{application.coverLetter}”</p>
                )}
                {history.length > 1 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                    <span className="font-semibold uppercase tracking-wider">Timeline:</span>
                    {history.map((h, i) => (
                      <span key={h.id} className="inline-flex items-center gap-1.5">
                        {i > 0 && <span>→</span>}
                        <span className="font-medium text-gray-600">{APPLICATION_STATUS_LABELS[h.toStatus]}</span>
                        <span>{timeAgo(h.createdAt)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
