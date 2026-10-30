import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { Briefcase } from "lucide-react";
import { db } from "@/db";
import { jobCategories, savedJobs } from "@/db/schema";
import { searchJobs } from "@/lib/queries";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { JobCard } from "@/components/job-card";
import { JobSearchBar, JobFilterPanel, Pagination } from "@/components/job-filters";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Browse jobs" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const categories = await db.select().from(jobCategories).orderBy(jobCategories.name);

  const { rows, total, page, pageCount } = await searchJobs({
    q: sp.q,
    location: sp.location,
    categoryId: sp.category,
    jobType: sp.jobType,
    workplace: sp.workplace,
    experience: sp.experience,
    minSalary: sp.minSalary ? Number(sp.minSalary) : undefined,
    maxSalary: sp.maxSalary ? Number(sp.maxSalary) : undefined,
    sort: sp.sort === "salary" ? "salary" : "newest",
    page: sp.page ? Number(sp.page) : 1,
  });

  let savedIds = new Set<string>();
  if (user?.role === "job_seeker") {
    const saved = await db.select({ jobId: savedJobs.jobId }).from(savedJobs).where(eq(savedJobs.seekerId, user.id));
    savedIds = new Set(saved.map((s) => s.jobId));
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-brand-950 sm:text-3xl">Find your next role</h1>
          <p className="mt-1 text-sm text-gray-500">{total} active job{total === 1 ? "" : "s"} — filtered in the database, fresh from employers.</p>
        </div>

        <Card className="mb-6 p-4">
          <Suspense><JobSearchBar categories={categories} compact /></Suspense>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
          <Card className="h-fit p-5 lg:sticky lg:top-20">
            <p className="mb-4 text-sm font-bold text-brand-900">Filters</p>
            <Suspense><JobFilterPanel categories={categories} /></Suspense>
          </Card>

          <div>
            {rows.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="h-6 w-6" />}
                title="No jobs match your filters"
                body="Try broadening your search — clearing salary or category filters often helps."
              />
            ) : (
              <div className="space-y-4">
                {rows.map(({ job, company, category }) => (
                  <JobCard key={job.id} job={job} company={company} category={category} saved={savedIds.has(job.id)} viewerRole={user?.role ?? null} />
                ))}
              </div>
            )}
            <Suspense><Pagination page={page} pageCount={pageCount} total={total} /></Suspense>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
