import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { AlertTriangle, Building2, MapPin } from "lucide-react";
import { db } from "@/db";
import { companies, jobs } from "@/db/schema";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Employers" };

export default async function EmployersPage() {
  try {
    const rows = await db
      .select({ company: companies, activeJobs: sql<number>`count(${jobs.id}) filter (where ${jobs.status} = 'active')::int` })
      .from(companies)
      .leftJoin(jobs, eq(jobs.companyId, companies.id))
      .groupBy(companies.id)
      .orderBy(desc(companies.createdAt))
      .limit(60);

    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
          <h1 className="text-2xl font-extrabold text-brand-950 sm:text-3xl">Hiring companies</h1>
          <p className="mt-1 text-sm text-gray-500">Every company below joined through the employer registration flow.</p>

          {rows.length === 0 ? (
            <div className="mt-8"><EmptyState icon={<Building2 className="h-6 w-6" />} title="No companies yet" body="Companies appear here when employers register." /></div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ company, activeJobs }) => (
                <Link key={company.id} href={`/employers/${company.slug}`}>
                  <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-900 text-sm font-extrabold text-accent-300">
                        {company.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-brand-950">{company.name}</p>
                        <p className="text-xs text-gray-500">{company.industry ?? "General"}</p>
                      </div>
                      {company.verified && <Badge tone="teal" className="ml-auto">Verified</Badge>}
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-gray-500">{company.tagline ?? company.description ?? "No description yet."}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{company.location ?? "—"}</span>
                      <span className="font-bold text-brand-800">{activeJobs} open role{activeJobs === 1 ? "" : "s"}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
        <SiteFooter />
      </>
    );
  } catch (err) {
    console.error("[employers] DB error:", err);
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-extrabold text-gray-900">Database not available</h1>
          <p className="mt-2 text-sm text-gray-500">Configure DATABASE_URL to see employer profiles.</p>
        </main>
        <SiteFooter />
      </>
    );
  }
}
