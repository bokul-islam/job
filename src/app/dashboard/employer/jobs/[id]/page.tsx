import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobCategories, jobs, jobSkills, skills } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { JobForm } from "@/components/job-form";
import { LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("employer");
  const { id } = await params;
  const job = (await db.select().from(jobs).where(eq(jobs.id, id)).limit(1))[0];
  if (!job || job.employerId !== user.id) notFound();

  const categories = await db.select().from(jobCategories).orderBy(jobCategories.name);
  const skillRows = await db
    .select({ skill: skills })
    .from(jobSkills)
    .innerJoin(skills, eq(skills.id, jobSkills.skillId))
    .where(eq(jobSkills.jobId, job.id));

  return (
    <DashboardShell active="/dashboard/employer/jobs">
      <PageHeader
        title={`Edit: ${job.title}`}
        subtitle={`Status: ${job.status}`}
        actions={<LinkButton href={`/jobs/${job.id}`} variant="outline">Preview public page</LinkButton>}
      />
      <JobForm categories={categories} job={job} skillNames={skillRows.map((s) => s.skill.name).join(", ")} />
    </DashboardShell>
  );
}
