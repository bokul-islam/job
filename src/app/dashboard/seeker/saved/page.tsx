import { desc, eq } from "drizzle-orm";
import { Bookmark } from "lucide-react";
import { db } from "@/db";
import { companies, jobCategories, jobs, savedJobs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { JobCard } from "@/components/job-card";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved jobs" };

export default async function SavedJobsPage() {
  const user = await requireRole("job_seeker");
  const rows = await db
    .select({ job: jobs, company: companies, category: jobCategories })
    .from(savedJobs)
    .innerJoin(jobs, eq(jobs.id, savedJobs.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId))
    .where(eq(savedJobs.seekerId, user.id))
    .orderBy(desc(savedJobs.createdAt));

  return (
    <DashboardShell active="/dashboard/seeker/saved">
      <PageHeader title="Saved jobs" subtitle="Bookmark roles to review and apply later." />
      {rows.length === 0 ? (
        <EmptyState icon={<Bookmark className="h-6 w-6" />} title="Nothing saved yet" body="Tap the bookmark icon on any job to keep it here." action={<LinkButton href="/jobs" variant="secondary">Browse jobs</LinkButton>} />
      ) : (
        <div className="space-y-4">
          {rows.map(({ job, company, category }) => (
            <JobCard key={job.id} job={job} company={company} category={category} saved viewerRole="job_seeker" />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
