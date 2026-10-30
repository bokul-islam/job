"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Clock3, MapPin, Users } from "lucide-react";
import { toggleSaveJobAction } from "@/lib/actions/jobs";
import { Badge, Card } from "@/components/ui";
import { formatSalary, timeAgo, JOB_TYPE_LABELS, WORKPLACE_LABELS, EXPERIENCE_LABELS } from "@/lib/utils";
import type { Company, Job, JobCategory } from "@/db/schema";

export function JobCard({
  job, company, category, saved = false, viewerRole,
}: {
  job: Job; company: Company; category: JobCategory | null; saved?: boolean; viewerRole?: string | null;
}) {
  const router = useRouter();
  const [isSaved, setIsSaved] = React.useState(saved);
  const [pending, start] = React.useTransition();
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);

  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (viewerRole !== "job_seeker") {
      router.push("/auth/login?next=/jobs");
      return;
    }
    start(async () => {
      const result = await toggleSaveJobAction(job.id);
      setIsSaved(result.saved);
    });
  }

  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <Card className="group p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-base font-extrabold text-brand-800">
            {company.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-brand-950 transition group-hover:text-brand-600">{job.title}</h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {company.name}
                  {company.verified && <Badge tone="teal" className="ml-2">Verified</Badge>}
                  {job.featured && <Badge tone="amber" className="ml-2">Featured</Badge>}
                </p>
              </div>
              <button
                onClick={toggleSave}
                disabled={pending}
                className={`rounded-lg p-2 transition ${isSaved ? "text-accent-600" : "text-gray-300 hover:bg-brand-50 hover:text-brand-700"}`}
                aria-label={isSaved ? "Unsave job" : "Save job"}
              >
                {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{timeAgo(job.createdAt)}</span>
              {job.vacancies > 1 && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{job.vacancies} openings</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone="navy">{JOB_TYPE_LABELS[job.jobType]}</Badge>
              <Badge tone="gray">{WORKPLACE_LABELS[job.workplaceType]}</Badge>
              <Badge tone="gray">{EXPERIENCE_LABELS[job.experienceLevel]}</Badge>
              {category && <Badge tone="blue">{category.name}</Badge>}
              {salary && <span className="ml-auto text-sm font-bold text-brand-900">{salary}</span>}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
