import Link from "next/link";
import { sql, eq } from "drizzle-orm";
import {
  ArrowRight, BadgeCheck, BarChart3, Building2, Clock3, Code2, Palette, Megaphone, Handshake,
  MessageSquareText, Search, ShieldCheck, Sparkles, Users, Video, Wallet, HeartPulse, GraduationCap,
  Database, PenTool, Briefcase, LineChart,
} from "lucide-react";
import { db } from "@/db";
import { jobs, users, applications, membershipPlans, jobCategories } from "@/db/schema";
import { featuredJobs, categoryCounts } from "@/lib/queries";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { JobCard } from "@/components/job-card";
import { JobSearchBar } from "@/components/job-filters";
import { Badge, Card, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  engineering: <Code2 className="h-5 w-5" />,
  design: <Palette className="h-5 w-5" />,
  marketing: <Megaphone className="h-5 w-5" />,
  sales: <Handshake className="h-5 w-5" />,
  finance: <Wallet className="h-5 w-5" />,
  "human-resources": <Users className="h-5 w-5" />,
  "customer-support": <HeartPulse className="h-5 w-5" />,
  "data-analytics": <Database className="h-5 w-5" />,
  product: <PenTool className="h-5 w-5" />,
  education: <GraduationCap className="h-5 w-5" />,
};

async function safeDbLoad() {
  try {
    const [featured, categoryRows, categories, seekerPlans, employerPlans, jobCountRows, userCountRows, appCountRows, companyCountRows] = await Promise.all([
      featuredJobs(6),
      categoryCounts(),
      db.select().from(jobCategories).orderBy(jobCategories.name),
      db.select().from(membershipPlans).where(eq(membershipPlans.audience, "job_seeker")).orderBy(membershipPlans.sortOrder),
      db.select().from(membershipPlans).where(eq(membershipPlans.audience, "employer")).orderBy(membershipPlans.sortOrder),
      db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.status, "active")),
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(applications),
      db.select({ count: sql<number>`count(distinct ${jobs.companyId})::int` }).from(jobs),
    ]);
    return {
      ok: true as const,
      featured, categoryRows, categories, seekerPlans, employerPlans,
      stats: [
        { label: "Live job posts", value: jobCountRows[0]?.count ?? 0 },
        { label: "Registered members", value: userCountRows[0]?.count ?? 0 },
        { label: "Applications tracked", value: appCountRows[0]?.count ?? 0 },
        { label: "Hiring companies", value: companyCountRows[0]?.count ?? 0 },
      ],
    };
  } catch (err) {
    console.error("[landing] DB load failed:", err);
    return {
      ok: false as const,
      featured: [] as Awaited<ReturnType<typeof featuredJobs>>,
      categoryRows: [] as Awaited<ReturnType<typeof categoryCounts>>,
      categories: [] as { id: string; name: string; slug: string; icon: string | null; createdAt: Date }[],
      seekerPlans: [] as typeof membershipPlans.$inferSelect[],
      employerPlans: [] as typeof membershipPlans.$inferSelect[],
      stats: [
        { label: "Live job posts", value: 0 },
        { label: "Registered members", value: 0 },
        { label: "Applications tracked", value: 0 },
        { label: "Hiring companies", value: 0 },
      ],
    };
  }
}

export default async function LandingPage() {
  const { ok, featured, categoryRows, categories, seekerPlans, employerPlans, stats } = await safeDbLoad();

  return (
    <>
      <SiteHeader />

      {!ok && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-4 text-center text-sm text-amber-900">
          <strong>⚠️ Database not connected.</strong>{" "}
          Set <code className="rounded bg-white px-1 py-0.5 text-xs font-mono font-bold">DATABASE_URL</code> in
          Vercel → Settings → Environment Variables, run{" "}
          <code className="rounded bg-white px-1 py-0.5 text-xs font-mono font-bold">npx drizzle-kit push</code>{" "}
          against your Supabase database, then redeploy.{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-bold">
            Create a free Supabase project →
          </a>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
          <div className="absolute -right-24 top-24 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="teal" className="mb-5 bg-white/10 !text-accent-300 ring-0">
              <Sparkles className="h-3 w-3" /> Verified profiles · transparent response times
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Where great careers meet
              <span className="bg-gradient-to-r from-accent-300 to-accent-500 bg-clip-text text-transparent"> great companies</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-brand-200 sm:text-lg">
              Apply with a video CV, chat in a secure inbox, and know exactly how fast employers respond — every metric comes from real marketplace activity.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
            <JobSearchBar categories={categories} />
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center backdrop-blur-sm">
                <p className="text-2xl font-extrabold text-white sm:text-3xl">{s.value.toLocaleString()}</p>
                <p className="mt-1 text-xs font-medium text-brand-200">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured jobs */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-brand-950 sm:text-3xl">Featured opportunities</h2>
            <p className="mt-1 text-sm text-gray-500">Fresh roles from verified companies, updated in real time.</p>
          </div>
          <Link href="/jobs" className="hidden items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-900 sm:flex">
            Browse all jobs <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {featured.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">No active jobs yet — be the first company to post one.</Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {featured.map(({ job, company, category }) => (
              <JobCard key={job.id} job={job} company={company} category={category} />
            ))}
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="border-y border-gray-200/70 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold text-brand-950 sm:text-3xl">Popular categories</h2>
          <p className="mt-1 text-sm text-gray-500">Live counts from the marketplace database.</p>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categoryRows.map(({ category, count }) => (
              <Link key={category.id} href={`/jobs?category=${category.id}`} className="group rounded-2xl border border-gray-200 bg-[#f8fafd] p-5 transition hover:border-brand-300 hover:bg-white hover:shadow-[var(--shadow-card)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 text-accent-300 transition group-hover:scale-105">
                  {CATEGORY_ICONS[category.slug] ?? <Briefcase className="h-5 w-5" />}
                </span>
                <p className="mt-3 text-sm font-bold text-brand-950">{category.name}</p>
                <p className="text-xs text-gray-500">{count} open role{count === 1 ? "" : "s"}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold text-brand-950 sm:text-3xl">How TalentBridge works</h2>
          <p className="mt-2 text-sm text-gray-500">Three steps — for both sides of the marketplace.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <HowStep step="01" icon={<BadgeCheck className="h-6 w-6" />} title="Create a verified profile"
            body="Job seekers add education, experience, skills, a PDF resume and an optional video CV. Employers build a verified company page." />
          <HowStep step="02" icon={<Search className="h-6 w-6" />} title="Match with intent"
            body="Search with real database filters — location, salary, experience, remote policy. Apply with one click or post a role in minutes." />
          <HowStep step="03" icon={<BarChart3 className="h-6 w-6" />} title="Communicate with accountability"
            body="A secure inbox with file attachments. Response-time analytics (average, median, response rate) are tracked for both sides — nobody can edit their score." />
        </div>
      </section>

      {/* Audiences */}
      <section className="grid gap-6 bg-brand-950 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <Building2 className="h-8 w-8 text-accent-300" />
          <h3 className="mt-4 text-2xl font-extrabold text-white">For employers</h3>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-brand-200">
            <Li>Publish roles with skills, salary bands and deadlines</Li>
            <Li>Search candidates and watch authorized video CVs</Li>
            <Li>Track applicants from submitted to hired</Li>
            <Li>Your response-time stats build candidate trust</Li>
          </ul>
          <div className="mt-6 flex gap-3">
            <LinkButton href="/auth/register?role=employer" variant="accent">Post a job</LinkButton>
            <LinkButton href="/dashboard/employer/candidates" variant="secondary" className="!bg-white/10 !text-white !border-0 hover:!bg-white/20">Explore candidates</LinkButton>
          </div>
        </div>
        <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <Video className="h-8 w-8 text-accent-300" />
          <h3 className="mt-4 text-2xl font-extrabold text-white">For job seekers</h3>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-brand-200">
            <Li>Stand out with a 2-minute video CV (Standard plan)</Li>
            <Li>Save jobs and track every application status change</Li>
            <Li>See how fast each employer typically replies</Li>
            <Li>Get notified the moment an employer views your profile</Li>
          </ul>
          <div className="mt-6 flex gap-3">
            <LinkButton href="/auth/register" variant="accent">Create your profile</LinkButton>
            <LinkButton href="/jobs" variant="secondary" className="!bg-white/10 !text-white !border-0 hover:!bg-white/20">Find a job</LinkButton>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold text-brand-950 sm:text-3xl">Membership plans</h2>
          <p className="mt-2 text-sm text-gray-500">Pricing and limits are managed by platform admins and enforced on the server.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <PlanSummary title="Job seeker plans" plans={seekerPlans.filter((p) => p.isActive)} href="/pricing" />
          <PlanSummary title="Employer plans" plans={employerPlans.filter((p) => p.isActive)} href="/pricing" />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-gray-200/70 bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-extrabold text-brand-950 sm:text-3xl">Frequently asked questions</h2>
          <div className="mt-10 space-y-4">
            <Faq q="Is TalentBridge free to use?"
              a="Yes. Both job seekers and employers get a free plan. Paid plans raise limits (applications per month, active job posts, daily messages) and unlock extras like video CVs and featured placement. All limits are validated on the server." />
            <Faq q="How do response-time scores work?"
              a="Whenever someone messages you, a response obligation is recorded. When you reply, we measure the elapsed time. Consecutive messages from the same person count once, and unanswered threads are tracked separately. Scores are computed from platform activity — they cannot be edited manually." />
            <Faq q="Who can see my video CV?"
              a="You choose: private (only you), verified employers, or public. Videos are stored privately and streamed only after a server-side permission check." />
            <Faq q="Are payments live?"
              a="This environment runs a clearly-labelled sandbox. SSLCommerz and bKash integrations activate when merchant credentials are configured, and subscriptions unlock only after a signed server-side webhook verifies payment." />
            <Faq q="How is my data protected?"
              a="Passwords are hashed with scrypt, sessions use HTTP-only cookies, files require signed, permission-checked URLs, and every sensitive action is validated server-side." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 to-brand-950 px-8 py-14 text-center sm:px-16">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
          <h2 className="relative text-3xl font-extrabold text-white">Ready to bridge the gap?</h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm text-brand-200">Join the marketplace where response times are public and great matches happen faster.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/jobs" variant="accent" size="lg">Find a Job</LinkButton>
            <LinkButton href="/auth/register?role=employer" size="lg" className="!bg-white !text-brand-900 hover:!bg-brand-50">Post a Job</LinkButton>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function HowStep({ step, icon, title, body }: { step: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card className="relative overflow-hidden p-7">
      <span className="absolute -right-2 -top-4 text-7xl font-black text-brand-50 select-none">{step}</span>
      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-900 text-accent-300">{icon}</span>
      <h3 className="relative mt-4 text-base font-bold text-brand-950">{title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
    </Card>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
      <span>{children}</span>
    </li>
  );
}

function PlanSummary({ title, plans, href }: { title: string; plans: { id: string; name: string; priceMonthly: number; features: string[] | null }[]; href: string }) {
  return (
    <Card className="p-7">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-brand-950">{title}</h3>
        <Link href={href} className="text-xs font-bold text-brand-600 hover:text-brand-800">Full comparison →</Link>
      </div>
      <div className="mt-5 space-y-4">
        {plans.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-[#f8fafd] px-4 py-3.5">
            <div>
              <p className="text-sm font-bold text-gray-900">{p.name}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{p.features?.[0] ?? ""}</p>
            </div>
            <p className="shrink-0 text-sm font-extrabold text-brand-900">{p.priceMonthly === 0 ? "Free" : `৳${p.priceMonthly.toLocaleString()}/mo`}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-gray-200 bg-[#f8fafd] open:bg-white open:shadow-[var(--shadow-card)]">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-bold text-brand-950 [&::-webkit-details-marker]:hidden">
        {q}
        <span className="ml-3 text-brand-400 transition group-open:rotate-45">+</span>
      </summary>
      <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{a}</p>
    </details>
  );
}
