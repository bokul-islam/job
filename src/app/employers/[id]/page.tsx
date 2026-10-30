import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { Building2, ExternalLink, MapPin, Users2 } from "lucide-react";
import { db } from "@/db";
import { companies, companyMembers, jobCategories, jobs } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { JobCard } from "@/components/job-card";
import { MessageComposer } from "@/components/start-conversation";
import { Badge, Card, CardHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EmployerPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const company = (await db.select().from(companies).where(eq(companies.slug, id)).limit(1))[0];
  if (!company) notFound();

  const members = await db.select().from(companyMembers).where(eq(companyMembers.companyId, company.id)).limit(1);
  const ownerId = members[0]?.userId;

  const activeJobs = await db
    .select({ job: jobs, company: companies, category: jobCategories })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(jobCategories, eq(jobCategories.id, jobs.categoryId))
    .where(and(eq(jobs.companyId, company.id), eq(jobs.status, "active")))
    .orderBy(desc(jobs.createdAt));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Card className="overflow-hidden">
          <div className="h-28 bg-gradient-to-r from-brand-900 via-brand-800 to-accent-700" />
          <div className="-mt-10 px-6 pb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-brand-900 text-2xl font-extrabold text-accent-300 shadow-md">
              {company.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-brand-950">
                  {company.name} {company.verified && <Badge tone="teal" className="ml-1 align-middle">Verified</Badge>}
                </h1>
                {company.tagline && <p className="mt-1 text-sm text-gray-500">{company.tagline}</p>}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                  {company.industry && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{company.industry}{company.size ? ` · ${company.size} employees` : ""}</span>}
                  {company.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{company.location}</span>}
                  {company.website && (
                    <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" />{company.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
              </div>
              {ownerId && user?.role === "job_seeker" && (
                <MessageComposer recipientId={ownerId} recipientName={company.name} label="Message recruiter" variant="primary" />
              )}
            </div>
            {company.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{company.description}</p>}
          </div>
        </Card>

        <Card className="mt-6">
          <CardHeader title={`Open roles (${activeJobs.length})`} subtitle="All statuses verified against the jobs database" />
          <div className="space-y-4 p-5">
            {activeJobs.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No open roles right now.</p>}
            {activeJobs.map(({ job, company: c, category }) => (
              <JobCard key={job.id} job={job} company={c} category={category} viewerRole={user?.role ?? null} />
            ))}
          </div>
        </Card>

        {!user && (
          <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-5 text-center text-sm text-brand-900">
            <Users2 className="mx-auto mb-2 h-5 w-5" /> Sign in to message this company and apply to their roles.
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
