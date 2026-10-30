import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { CalendarDays, MapPin, PhoneCall, Globe, Star, Clock3 } from "lucide-react";
import { db } from "@/db";
import {
  education, jobSeekerProfiles, jobSeekerSkills, skills, users, videoCvs, workExperience,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getResponseStatsFor } from "@/lib/queries";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { MessageComposer } from "@/components/start-conversation";
import { ReportButton } from "@/components/report-button";
import { Avatar, Badge, Card, CardHeader } from "@/components/ui";
import { formatDuration, formatMoney, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CandidatePublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getSessionUser();
  if (!viewer) redirect(`/auth/login?next=/candidates/${id}`);

  const candidate = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  if (!candidate || candidate.role !== "job_seeker") notFound();
  const profile = (await db.select().from(jobSeekerProfiles).where(eq(jobSeekerProfiles.userId, id)).limit(1))[0];
  if (!profile) notFound();

  const isSelf = viewer.id === id;
  const isAdminViewer = viewer.role === "admin" || viewer.role === "super_admin";
  if (profile.visibility === "private" && !isSelf && !isAdminViewer) notFound();
  if (profile.visibility === "employers" && !isSelf && !isAdminViewer && viewer.role !== "employer") notFound();

  const [skillRows, edu, exp, vids, stats] = await Promise.all([
    db.select({ skill: skills }).from(jobSeekerSkills).innerJoin(skills, eq(skills.id, jobSeekerSkills.skillId)).where(eq(jobSeekerSkills.seekerId, profile.id)),
    db.select().from(education).where(eq(education.seekerId, profile.id)),
    db.select().from(workExperience).where(eq(workExperience.seekerId, profile.id)),
    db.select().from(videoCvs).where(eq(videoCvs.seekerId, profile.id)),
    getResponseStatsFor(candidate.id),
  ]);

  const viewerIsEmployer = viewer.role === "employer" && !!viewer.emailVerifiedAt;
  const visibleVideos = vids.filter((v) =>
    v.status === "ready" &&
    (v.visibility === "public" || (v.visibility === "employers" && (viewerIsEmployer || isAdminViewer)) || isSelf)
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Card className="p-6">
          <div className="flex flex-wrap items-start gap-5">
            <Avatar name={candidate.name} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold text-brand-950">{candidate.name}</h1>
                {candidate.emailVerifiedAt && <Badge tone="teal">Email verified</Badge>}
                <Badge tone="gray">Member since {candidate.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</Badge>
              </div>
              {profile.headline && <p className="mt-1 text-sm font-medium text-gray-600">{profile.headline}</p>}
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                {profile.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.location}</span>}
                {profile.availability && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{profile.availability}</span>}
                {(profile.phone && (viewerIsEmployer || isSelf || isAdminViewer)) && <span className="inline-flex items-center gap-1"><PhoneCall className="h-3.5 w-3.5" />{profile.phone}</span>}
                {profile.website && <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={profile.website} target="_blank" rel="noreferrer"><Globe className="h-3.5 w-3.5" />Portfolio</a>}
              </div>
              {(profile.expectedSalaryMin || profile.expectedSalaryMax) && (
                <p className="mt-2 text-sm font-semibold text-brand-800">
                  Expected: {formatMoney(profile.expectedSalaryMin ?? 0)} – {formatMoney(profile.expectedSalaryMax ?? 0)} / month
                </p>
              )}
            </div>
            {viewerIsEmployer && !isSelf && (
              <div className="flex gap-2">
                <MessageComposer recipientId={candidate.id} recipientName={candidate.name} label="Message candidate" variant="primary" />
                <ReportButton targetType="user" targetId={candidate.id} />
              </div>
            )}
          </div>
          {profile.bio && <p className="mt-5 whitespace-pre-wrap border-t border-gray-100 pt-5 text-sm leading-relaxed text-gray-600">{profile.bio}</p>}
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,320px]">
          <div className="space-y-6">
            {visibleVideos.length > 0 && (
              <Card>
                <CardHeader title="Video CV" />
                <div className="space-y-4 p-5">
                  {visibleVideos.map((v) => (
                    <div key={v.id}>
                      <video src={`/api/files/${v.fileKey}`} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black" />
                      <p className="mt-2 text-sm font-semibold text-gray-900">{v.title}</p>
                      {v.description && <p className="text-xs text-gray-500">{v.description}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <CardHeader title="Experience" />
              <div className="space-y-3 p-5">
                {exp.length === 0 && <p className="text-sm text-gray-400">No experience listed.</p>}
                {exp.map((e) => (
                  <div key={e.id} className="rounded-xl border border-gray-100 p-4">
                    <p className="text-sm font-bold text-gray-900">{e.title} · {e.company}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{[e.location, e.startDate ? `${e.startDate} – ${e.isCurrent ? "Present" : e.endDate ?? ""}` : null].filter(Boolean).join(" · ")}</p>
                    {e.description && <p className="mt-2 text-xs leading-relaxed text-gray-600">{e.description}</p>}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Education" />
              <div className="space-y-3 p-5">
                {edu.length === 0 && <p className="text-sm text-gray-400">No education listed.</p>}
                {edu.map((e) => (
                  <div key={e.id} className="rounded-xl border border-gray-100 p-4">
                    <p className="text-sm font-bold text-gray-900">{e.degree}{e.field ? ` · ${e.field}` : ""}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{e.institution}{e.startYear ? ` · ${e.startYear} – ${e.endYear ?? "Present"}` : ""}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Response profile" subtitle={`Last active ${timeAgo(candidate.lastActiveAt)}`} />
              <div className="space-y-3 p-5 text-sm">
                <RespLine label="Average response" value={formatDuration(stats.overall.avgSeconds)} />
                <RespLine label="Median response" value={formatDuration(stats.overall.medianSeconds)} />
                <RespLine label="Response rate" value={`${stats.overall.responseRate}%`} />
                <RespLine label="Replied to" value={`${stats.overall.totalAnswered} of ${stats.overall.totalReceived} messages`} />
                <p className="flex items-center gap-1.5 text-[11px] text-gray-400"><Clock3 className="h-3 w-3" /> From real message events — not editable.</p>
              </div>
            </Card>
            <Card>
              <CardHeader title="Skills" />
              <div className="flex flex-wrap gap-2 p-5">
                {skillRows.length === 0 && <p className="text-sm text-gray-400">No skills listed.</p>}
                {skillRows.map(({ skill }) => <Badge key={skill.id} tone="navy"><Star className="h-3 w-3" /> {skill.name}</Badge>)}
              </div>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function RespLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold text-brand-900">{value}</span>
    </div>
  );
}
