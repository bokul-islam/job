import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Eye, Newspaper, Pencil, Users2 } from "lucide-react";
import { db } from "@/db";
import { applications, jobs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { activeJobPostCount, resolvePlan } from "@/lib/entitlements";
import { setJobStatusAction } from "@/lib/actions/jobs";
import { DashboardShell } from "@/components/dashboard-shell";
import { Alert, Badge, Button, Card, EmptyState, LinkButton, PageHeader, STATUS_TONES } from "@/components/ui";
import { formatSalary, timeAgo, JOB_TYPE_LABELS } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job posts" };

export default async function EmployerJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireRole("employer");
  const rows = await db
    .select({
      job: jobs,
      applicationCount: sql<number>`(select count(*) from ${applications} a where a.job_id = ${jobs.id})::int`,
    })
    .from(jobs)
    .where(eq(jobs.employerId, user.id))
    .orderBy(desc(jobs.createdAt));

  const { plan, limits } = await resolvePlan(user);
  const activeCount = await activeJobPostCount(user.id);

  return (
    <DashboardShell active="/dashboard/employer/jobs">
      <PageHeader
        title="Job posts"
        subtitle={`${activeCount}/${limits.activeJobPosts} active posts used on your ${plan?.name ?? "Free"} plan.`}
        actions={<LinkButton href="/dashboard/employer/jobs/new">+ New job post</LinkButton>}
      />
      {sp.created && <div className="mb-4"><Alert tone="success">Job created. You can publish it from this list.</Alert></div>}
      {activeCount >= limits.activeJobPosts && (
        <div className="mb-4">
          <Alert tone="warning">You&apos;ve reached the active-post limit of your plan. Close a post or <Link className="font-bold underline" href="/pricing">upgrade</Link>.</Alert>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<Newspaper className="h-6 w-6" />} title="No job posts yet" body="Create your first vacancy — drafts are free to save." action={<LinkButton href="/dashboard/employer/jobs/new" variant="secondary">Post a job</LinkButton>} />
      ) : (
        <Card>
          <div className="divide-y divide-gray-100">
            {rows.map(({ job, applicationCount }) => (
              <div key={job.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/jobs/${job.id}`} className="font-bold text-brand-950 hover:text-brand-600">{job.title}</Link>
                    <Badge tone={STATUS_TONES[job.status]}>{job.status}</Badge>
                    {job.flagged && <Badge tone="red">flagged</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {JOB_TYPE_LABELS[job.jobType]} · {job.location} · {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod) ?? "Salary hidden"} · posted {timeAgo(job.createdAt)}
                    {job.deadline && ` · deadline ${job.deadline.toDateString()}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-gray-500"><Users2 className="h-3.5 w-3.5" />{applicationCount}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Eye className="h-3.5 w-3.5" />{job.viewsCount}</span>
                  <LinkButton href={`/dashboard/employer/jobs/${job.id}/applications`} variant="secondary" size="sm">Applicants</LinkButton>
                  <LinkButton href={`/dashboard/employer/jobs/${job.id}`} variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>
                  {job.status !== "active" && (
                    <form action={async () => { "use server"; await setJobStatusAction(job.id, "active"); }}>
                      <Button size="sm" type="submit">Publish</Button>
                    </form>
                  )}
                  {job.status === "active" && (
                    <form action={async () => { "use server"; await setJobStatusAction(job.id, "paused"); }}>
                      <Button size="sm" variant="outline" type="submit">Pause</Button>
                    </form>
                  )}
                  {job.status !== "closed" && (
                    <form action={async () => { "use server"; await setJobStatusAction(job.id, "closed"); }}>
                      <Button size="sm" variant="ghost" type="submit" className="text-red-600">Close</Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}
