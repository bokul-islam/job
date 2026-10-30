import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { FileText, Inbox } from "lucide-react";
import { db } from "@/db";
import {
  applications, applicationStatusHistory, jobs, jobSeekerProfiles, resumes, users, videoCvs,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { markApplicationViewedAction, updateApplicationStatusAction } from "@/lib/actions/applications";
import { DashboardShell } from "@/components/dashboard-shell";
import { MessageComposer } from "@/components/start-conversation";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, STATUS_TONES } from "@/components/ui";
import { formatDuration, timeAgo, APPLICATION_STATUS_LABELS } from "@/lib/utils";
import { getResponseStatsFor } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applicants" };

const NEXT_ACTIONS: Record<string, { label: string; to: string; tone?: "accent" | "danger" }[]> = {
  submitted: [
    { label: "Shortlist", to: "shortlisted", tone: "accent" },
    { label: "Invite to interview", to: "interview" },
    { label: "Reject", to: "rejected", tone: "danger" },
  ],
  viewed: [
    { label: "Shortlist", to: "shortlisted", tone: "accent" },
    { label: "Invite to interview", to: "interview" },
    { label: "Reject", to: "rejected", tone: "danger" },
  ],
  shortlisted: [
    { label: "Invite to interview", to: "interview" },
    { label: "Hire", to: "hired", tone: "accent" },
    { label: "Reject", to: "rejected", tone: "danger" },
  ],
  interview: [
    { label: "Hire", to: "hired", tone: "accent" },
    { label: "Reject", to: "rejected", tone: "danger" },
  ],
  rejected: [],
  hired: [],
  withdrawn: [],
};

export default async function ApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("employer");
  const { id } = await params;
  const job = (await db.select().from(jobs).where(eq(jobs.id, id)).limit(1))[0];
  if (!job || job.employerId !== user.id) notFound();

  const rows = await db
    .select({ application: applications, seeker: users, profile: jobSeekerProfiles, resume: resumes })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.seekerId))
    .leftJoin(jobSeekerProfiles, eq(jobSeekerProfiles.userId, applications.seekerId))
    .leftJoin(resumes, eq(resumes.id, applications.resumeId))
    .where(eq(applications.jobId, job.id))
    .orderBy(desc(applications.createdAt));

  const histories = rows.length ? await db.select().from(applicationStatusHistory).orderBy(applicationStatusHistory.createdAt) : [];
  const seekerIds = rows.map((r) => r.seeker.id);
  const videoRows = seekerIds.length
    ? await db.select().from(videoCvs)
    : [];

  const statsBySeeker = new Map<string, Awaited<ReturnType<typeof getResponseStatsFor>>>();
  for (const r of rows) {
    if (!statsBySeeker.has(r.seeker.id)) statsBySeeker.set(r.seeker.id, await getResponseStatsFor(r.seeker.id));
  }

  const visible = rows.filter((r) => r.application.status !== "withdrawn");

  return (
    <DashboardShell active="/dashboard/employer/jobs">
      <PageHeader
        title={`Applicants · ${job.title}`}
        subtitle={`${visible.length} active application${visible.length === 1 ? "" : "s"}`}
        actions={<Link href={`/dashboard/employer/jobs`} className="text-xs font-bold text-brand-600 hover:text-brand-800">← All job posts</Link>}
      />

      {visible.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title="No applicants yet" body="Share your job post or wait for candidates to discover it in search." />
      ) : (
        <div className="space-y-4">
          {visible.map(({ application, seeker, profile, resume }) => {
            const history = histories.filter((h) => h.applicationId === application.id);
            const stats = statsBySeeker.get(seeker.id);
            const vids = profile ? videoRows.filter((v) => v.seekerId === profile.id && v.status === "ready") : [];
            const actions = NEXT_ACTIONS[application.status] ?? [];
            return (
              <Card key={application.id} className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar name={seeker.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/candidates/${seeker.id}`} className="font-bold text-brand-950 hover:text-brand-600">{seeker.name}</Link>
                      <Badge tone={STATUS_TONES[application.status]}>{APPLICATION_STATUS_LABELS[application.status]}</Badge>
                      {profile?.headline && <span className="truncate text-xs text-gray-500">{profile.headline}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Applied {timeAgo(application.createdAt)}
                      {stats && stats.overall.totalReceived > 0 && (
                        <span className="ml-2 font-semibold text-brand-700">
                          · replies in {formatDuration(stats.overall.avgSeconds)} ({stats.overall.responseRate}%)
                        </span>
                      )}
                    </p>
                    {application.coverLetter && (
                      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#f8fafd] px-4 py-3 text-xs leading-relaxed text-gray-600">{application.coverLetter}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {resume && (
                        <a href={`/api/files/${resume.fileKey}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-sm transition hover:border-brand-300">
                          <FileText className="h-3.5 w-3.5" /> View resume
                        </a>
                      )}
                      {vids.map((v) => (
                        <a key={v.id} href={`/candidates/${seeker.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-700">
                          ▶ Video CV available
                        </a>
                      ))}
                      <MessageComposer recipientId={seeker.id} recipientName={seeker.name} applicationId={application.id} label="Message" />
                      {application.status === "submitted" && (
                        <form action={async () => { "use server"; await markApplicationViewedAction(application.id); }}>
                          <Button size="sm" variant="ghost" type="submit">Mark viewed</Button>
                        </form>
                      )}
                      {actions.map((a) => (
                        <form key={a.to} action={async () => { "use server"; await updateApplicationStatusAction(application.id, a.to); }}>
                          <Button size="sm" type="submit" variant={a.tone === "danger" ? "danger" : a.tone === "accent" ? "accent" : "outline"}>
                            {a.label}
                          </Button>
                        </form>
                      ))}
                    </div>
                    {history.length > 1 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                        {history.map((h, i) => (
                          <span key={h.id} className="inline-flex items-center gap-1.5">
                            {i > 0 && <span>→</span>}
                            <span className="font-medium text-gray-600">{APPLICATION_STATUS_LABELS[h.toStatus]}</span>
                            <span>{timeAgo(h.createdAt)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
