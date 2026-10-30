import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { Building2, CalendarDays, MapPin, Users2, Wallet, ExternalLink, Clock3 } from "lucide-react";
import { db } from "@/db";
import { applications, jobs, jobSeekerProfiles, jobSkills, resumes, companies, savedJobs, skills } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getJobWithCompany, getResponseStatsFor } from "@/lib/queries";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { ApplyDialog } from "@/components/apply-dialog";
import { MessageComposer } from "@/components/start-conversation";
import { ReportButton } from "@/components/report-button";
import { Badge, Card, CardHeader } from "@/components/ui";
import { formatDuration, formatSalary, timeAgo, JOB_TYPE_LABELS, WORKPLACE_LABELS, EXPERIENCE_LABELS } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const data = await getJobWithCompany(id).catch(() => null);
  if (!data) notFound();
  const { job, company, category, employer } = data;

  const isPublic = job.status === "active";
  const isOwner = user?.id === job.employerId;
  if (!isPublic && !isOwner && !(user && ["admin", "super_admin"].includes(user.role))) notFound();

  // view counter (fire and forget-ish; cheap single update)
  await db.update(jobs).set({ viewsCount: sql`${jobs.viewsCount} + 1` }).where(eq(jobs.id, job.id));

  const skillRows = await db
    .select({ skill: skills })
    .from(jobSkills)
    .innerJoin(skills, eq(skills.id, jobSkills.skillId))
    .where(eq(jobSkills.jobId, job.id));

  let hasApplied = false;
  let myResumes: (typeof resumes.$inferSelect)[] = [];
  let savedJob = false;
  if (user?.role === "job_seeker") {
    const app = await db.select({ id: applications.id }).from(applications)
      .where(and(eq(applications.jobId, job.id), eq(applications.seekerId, user.id), ne(applications.status, "withdrawn"))).limit(1);
    hasApplied = app.length > 0;
    const profile = (await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, user.id)).limit(1))[0];
    if (profile) myResumes = await db.select().from(resumes).where(eq(resumes.seekerId, profile.id));
    savedJob = (await db.select().from(savedJobs).where(and(eq(savedJobs.jobId, job.id), eq(savedJobs.seekerId, user.id))).limit(1)).length > 0;
  }

  const employerStats = await getResponseStatsFor(job.employerId);
  const related = await db
    .select({ job: jobs, company: companies })
    .from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(and(eq(jobs.status, "active"), ne(jobs.id, job.id), job.categoryId ? eq(jobs.categoryId, job.categoryId) : undefined))
    .orderBy(desc(jobs.createdAt))
    .limit(3);

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const deadlinePassed = job.deadline ? job.deadline.getTime() < Date.now() : false;
  const applyDisabledReason =
    !user ? "Sign in as a job seeker to apply"
    : user.role !== "job_seeker" ? "Only job seekers can apply"
    : !user.emailVerifiedAt ? "Verify your email to apply"
    : job.status !== "active" ? "This job is not accepting applications"
    : deadlinePassed ? "The application deadline has passed"
    : undefined;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/jobs" className="text-xs font-semibold text-brand-600 hover:text-brand-800">← Back to all jobs</Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr,340px]">
          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-900 text-lg font-extrabold text-accent-300">
                  {company.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-extrabold text-brand-950">{job.title}</h1>
                    {job.status !== "active" && <Badge tone="amber">Not public: {job.status}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    <Link href={`/employers/${company.slug}`} className="font-semibold text-brand-700 hover:underline">{company.name}</Link>
                    {company.verified && <Badge tone="teal" className="ml-2">Verified</Badge>}
                    {" · "}{job.location}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="navy">{JOB_TYPE_LABELS[job.jobType]}</Badge>
                    <Badge tone="gray">{WORKPLACE_LABELS[job.workplaceType]}</Badge>
                    <Badge tone="gray">{EXPERIENCE_LABELS[job.experienceLevel]}</Badge>
                    {category && <Badge tone="blue">{category.name}</Badge>}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5 text-sm md:grid-cols-4">
                <Meta icon={<Wallet className="h-4 w-4" />} label="Salary" value={salary ?? "Not disclosed"} />
                <Meta icon={<MapPin className="h-4 w-4" />} label="Location" value={job.location} />
                <Meta icon={<Users2 className="h-4 w-4" />} label="Vacancies" value={String(job.vacancies)} />
                <Meta icon={<CalendarDays className="h-4 w-4" />} label="Deadline" value={job.deadline ? job.deadline.toDateString() : "Open"} warn={deadlinePassed} />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {user?.role === "job_seeker" || !user ? (
                  <ApplyDialog jobId={job.id} resumes={myResumes} applied={hasApplied} disabledReason={applyDisabledReason} />
                ) : null}
                {user && user.role === "employer" && !isOwner && null}
                {(!user || user.role === "job_seeker") && (
                  <MessageComposer recipientId={job.employerId} recipientName={company.name} jobId={job.id} label="Ask a question" size="lg" />
                )}
                {user && <ReportButton targetType="job" targetId={job.id} />}
              </div>
            </Card>

            <Card>
              <CardHeader title="Job description" />
              <div className="prose-lite px-6 py-5 text-sm leading-relaxed text-gray-700">
                <p className="whitespace-pre-wrap">{job.description}</p>
                {job.responsibilities && <ListSection title="Responsibilities" text={job.responsibilities} />}
                {job.requirements && <ListSection title="Requirements" text={job.requirements} />}
                {job.benefits && <ListSection title="Benefits" text={job.benefits} />}
              </div>
            </Card>

            {skillRows.length > 0 && (
              <Card className="p-5">
                <p className="mb-3 text-sm font-bold text-brand-900">Skills for this role</p>
                <div className="flex flex-wrap gap-2">
                  {skillRows.map(({ skill }) => <Badge key={skill.id} tone="navy" className="!px-3 !py-1 !text-xs">{skill.name}</Badge>)}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Employer responsiveness" subtitle="Computed from real message activity" />
              <div className="space-y-3 p-5 text-sm">
                <StatLine label="Average response" value={formatDuration(employerStats.overall.avgSeconds)} />
                <StatLine label="Median response" value={formatDuration(employerStats.overall.medianSeconds)} />
                <StatLine label="Response rate" value={`${employerStats.overall.responseRate}%`} />
                <StatLine label="Messages answered" value={`${employerStats.overall.totalAnswered}/${employerStats.overall.totalReceived}`} />
                <p className="flex items-center gap-1.5 pt-1 text-[11px] text-gray-400">
                  <Clock3 className="h-3 w-3" /> Scores cannot be edited manually.
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="About the company" />
              <div className="space-y-2.5 p-5 text-sm text-gray-600">
                <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-400" /> {company.industry ?? "Industry not specified"}{company.size ? ` · ${company.size} employees` : ""}</p>
                {company.website && (
                  <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-brand-700 hover:underline">
                    <ExternalLink className="h-4 w-4" /> {company.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                <Link href={`/employers/${company.slug}`} className="block pt-1 text-xs font-bold text-brand-600 hover:text-brand-800">
                  View company profile →
                </Link>
              </div>
            </Card>

            {savedJob && user?.role === "job_seeker" && <Card className="p-4 text-center text-xs font-semibold text-accent-700">Saved to your list</Card>}

            {related.length > 0 && (
              <Card>
                <CardHeader title="Similar roles" />
                <div className="space-y-3 p-5">
                  {related.map(({ job: r, company: c }) => (
                    <Link key={r.id} href={`/jobs/${r.id}`} className="block rounded-xl border border-gray-100 p-3.5 transition hover:border-brand-300 hover:bg-brand-50/40">
                      <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{c.name} · {r.location} · {timeAgo(r.createdAt)}</p>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Meta({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${warn ? "border-red-200 bg-red-50" : "border-gray-100 bg-[#f8fafd]"}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{icon} {label}</p>
      <p className={`mt-1 text-sm font-bold ${warn ? "text-red-600" : "text-brand-950"}`}>{value}</p>
    </div>
  );
}

function ListSection({ title, text }: { title: string; text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <>
      <h3>{title}</h3>
      {lines.length > 1 ? (
        <ul>{lines.map((l, i) => <li key={i}>{l.replace(/^[-•]\s*/, "")}</li>)}</ul>
      ) : (
        <p>{text}</p>
      )}
    </>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold text-brand-900">{value}</span>
    </div>
  );
}
