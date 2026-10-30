import { eq } from "drizzle-orm";
import { db } from "@/db";
import { education, jobSeekerSkills, resumes, skills, workExperience } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { seekerProfileFor } from "@/lib/queries";
import { DashboardShell } from "@/components/dashboard-shell";
import { EducationBlock, ExperienceBlock, SeekerProfileForm } from "@/components/profile-forms";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "My profile" };

export default async function SeekerProfilePage() {
  const user = await requireRole("job_seeker");
  const profile = await seekerProfileFor(user.id);
  if (!profile) return null;

  const [skillRows, edu, exp, resumeRows] = await Promise.all([
    db.select({ skill: skills }).from(jobSeekerSkills).innerJoin(skills, eq(skills.id, jobSeekerSkills.skillId)).where(eq(jobSeekerSkills.seekerId, profile.id)),
    db.select().from(education).where(eq(education.seekerId, profile.id)),
    db.select().from(workExperience).where(eq(workExperience.seekerId, profile.id)),
    db.select().from(resumes).where(eq(resumes.seekerId, profile.id)),
  ]);
  const skillNames = skillRows.map((s) => s.skill.name).join(", ");

  return (
    <DashboardShell active="/dashboard/seeker/profile">
      <PageHeader title="My profile" subtitle={`Profile strength: ${profile.completionPct}% — employers see most of this on your public page.`} />
      <SeekerProfileForm profile={profile} skillNames={skillNames} resumes={resumeRows} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ExperienceBlock entries={exp} />
        <EducationBlock entries={edu} />
      </div>
    </DashboardShell>
  );
}
