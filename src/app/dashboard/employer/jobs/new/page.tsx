import { db } from "@/db";
import { jobCategories } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { JobForm } from "@/components/job-form";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "New job post" };

export default async function NewJobPage() {
  await requireRole("employer");
  const categories = await db.select().from(jobCategories).orderBy(jobCategories.name);
  return (
    <DashboardShell active="/dashboard/employer/jobs">
      <PageHeader title="Create a job post" subtitle="Draft it first, preview on the public page, then publish within your plan limits." />
      <JobForm categories={categories} />
    </DashboardShell>
  );
}
