"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { GraduationCap, Briefcase, Plus, Star, Trash2 } from "lucide-react";
import {
  addEducationAction, addExperienceAction, deleteEducationAction, deleteExperienceAction,
  detachResumeAction, setPrimaryResumeAction, updateSeekerProfileAction, updateCompanyAction,
} from "@/lib/actions/profile";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { FileUploader } from "@/components/file-uploader";
import { formatBytes, timeAgo } from "@/lib/utils";
import type { Company, JobSeekerProfile, Resume } from "@/db/schema";
import type { ActionState } from "@/lib/actions/auth";

/* ------------------------------ Seeker profile ------------------------------ */

type SeekerValues = {
  headline: string; bio: string; location: string; phone: string; website: string;
  currentTitle: string; yearsExperience: string; expectedSalaryMin: string; expectedSalaryMax: string;
  availability: string; visibility: string; skills: string;
};

export function SeekerProfileForm({ profile, skillNames, resumes }: {
  profile: JobSeekerProfile | null; skillNames: string; resumes: Resume[];
}) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(updateSeekerProfileAction, {});
  const { register } = useForm<SeekerValues>({
    defaultValues: {
      headline: profile?.headline ?? "",
      bio: profile?.bio ?? "",
      location: profile?.location ?? "",
      phone: profile?.phone ?? "",
      website: profile?.website ?? "",
      currentTitle: profile?.currentTitle ?? "",
      yearsExperience: profile?.yearsExperience != null ? String(profile.yearsExperience) : "",
      expectedSalaryMin: profile?.expectedSalaryMin != null ? String(profile.expectedSalaryMin) : "",
      expectedSalaryMax: profile?.expectedSalaryMax != null ? String(profile.expectedSalaryMax) : "",
      availability: profile?.availability ?? "",
      visibility: profile?.visibility ?? "public",
      skills: skillNames,
    },
  });
  const fe = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <form action={formAction}>
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Professional profile</h2>
            {state.success && <Badge tone="green">{state.success}</Badge>}
          </div>
          {state.error && <div className="mb-4"><Alert tone="error">{state.error}</Alert></div>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Headline" error={fe.headline} className="md:col-span-2">
              <Input {...register("headline")} name="headline" placeholder="e.g. Full-Stack Developer · 4 yrs · React & Node" />
            </Field>
            <Field label="Bio" error={fe.bio} className="md:col-span-2">
              <Textarea rows={4} {...register("bio")} name="bio" placeholder="Summarize your experience and what you're looking for." />
            </Field>
            <Field label="Current title" error={fe.currentTitle}>
              <Input {...register("currentTitle")} name="currentTitle" placeholder="Software Engineer" />
            </Field>
            <Field label="Location" error={fe.location}>
              <Input {...register("location")} name="location" placeholder="Dhaka, Bangladesh" />
            </Field>
            <Field label="Phone" error={fe.phone}>
              <Input {...register("phone")} name="phone" placeholder="+880 …" />
            </Field>
            <Field label="Website / portfolio" error={fe.website}>
              <Input {...register("website")} name="website" placeholder="https://…" />
            </Field>
            <Field label="Years of experience" error={fe.yearsExperience}>
              <Input type="number" min={0} max={60} {...register("yearsExperience")} name="yearsExperience" />
            </Field>
            <Field label="Availability" error={fe.availability}>
              <Input {...register("availability")} name="availability" placeholder="e.g. Available in 2 weeks" />
            </Field>
            <Field label="Expected salary min (BDT/mo)" error={fe.expectedSalaryMin}>
              <Input type="number" min={0} {...register("expectedSalaryMin")} name="expectedSalaryMin" />
            </Field>
            <Field label="Expected salary max (BDT/mo)" error={fe.expectedSalaryMax}>
              <Input type="number" min={0} {...register("expectedSalaryMax")} name="expectedSalaryMax" />
            </Field>
            <Field label="Skills" hint="Comma separated" error={fe.skills} className="md:col-span-2">
              <Input {...register("skills")} name="skills" placeholder="React, TypeScript, PostgreSQL…" />
            </Field>
            <Field label="Profile visibility" hint="Controls who can view your profile and video CV">
              <Select {...register("visibility")} name="visibility">
                <option value="public">Public — visible on candidate search</option>
                <option value="employers">Employers only</option>
                <option value="private">Private — only companies I apply to</option>
              </Select>
            </Field>
          </div>
          <Button type="submit" loading={pending} className="mt-5">Save profile</Button>
        </Card>
      </form>

      <ResumeManager resumes={resumes} />
    </div>
  );
}

function ResumeManager({ resumes }: { resumes: Resume[] }) {
  return (
    <Card>
      <CardHeader title="Resumes" subtitle="PDF only · max 10 MB · server-validated" />
      <div className="space-y-3 p-5">
        {resumes.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {r.title} {r.isPrimary && <Badge tone="teal" className="ml-1">Primary</Badge>}
                {r.status !== "ready" && <Badge tone="amber" className="ml-1">{r.status}</Badge>}
              </p>
              <p className="text-xs text-gray-500">{r.fileName} · {formatBytes(r.fileSize)} · {timeAgo(r.createdAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => window.open(`/api/files/${r.fileKey}`, "_blank")}>View</Button>
              {!r.isPrimary && (
                <Button size="sm" variant="ghost" onClick={async () => setPrimaryResumeAction(r.id)} title="Set as primary"><Star className="h-4 w-4" /></Button>
              )}
              <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (confirm("Delete this resume?")) await detachResumeAction(r.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <FileUploader
          purpose="resume"
          accept="application/pdf"
          maxBytes={10 * 1024 * 1024}
          label="Upload new resume"
          extraMeta={() => ({})}
          onComplete={async ({ key, fileName, size, mimeType }) => {
            const { confirmResumeUploadAction } = await import("@/lib/actions/uploads");
            const res = await confirmResumeUploadAction({ key, fileName, size, mimeType, title: fileName });
            if (!res.error) window.location.reload();
            return res;
          }}
        />
      </div>
    </Card>
  );
}

/* --------------------------- Education & experience --------------------------- */

export function EducationBlock({ entries }: { entries: { id: string; institution: string; degree: string; field: string | null; startYear: number | null; endYear: number | null }[] }) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(addEducationAction, {});
  const [open, setOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader
        title="Education"
        action={<Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}><Plus className="h-4 w-4" /> Add</Button>}
      />
      <div className="space-y-3 p-5">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {entries.length === 0 && <p className="text-sm text-gray-400">No education entries yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
            <div className="flex items-start gap-3">
              <GraduationCap className="mt-0.5 h-5 w-5 text-brand-400" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{e.degree}{e.field ? ` · ${e.field}` : ""}</p>
                <p className="text-xs text-gray-500">{e.institution}{e.startYear ? ` · ${e.startYear} – ${e.endYear ?? "Present"}` : ""}</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => deleteEducationAction(e.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {open && (
          <form action={async (fd) => { const r = await formAction(fd); setOpen(false); return r; }} className="grid gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4 md:grid-cols-2">
            <Input name="institution" placeholder="Institution *" required />
            <Input name="degree" placeholder="Degree *" required />
            <Input name="field" placeholder="Field of study" />
            <div className="flex gap-3">
              <Input name="startYear" type="number" placeholder="Start year" />
              <Input name="endYear" type="number" placeholder="End year" />
            </div>
            <div className="md:col-span-2">
              <Button size="sm" type="submit" loading={pending}>Save education</Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

export function ExperienceBlock({ entries }: { entries: { id: string; company: string; title: string; location: string | null; isCurrent: boolean; startDate: string | null; endDate: string | null; description: string | null }[] }) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(addExperienceAction, {});
  const [open, setOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader
        title="Work experience"
        action={<Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}><Plus className="h-4 w-4" /> Add</Button>}
      />
      <div className="space-y-3 p-5">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {entries.length === 0 && <p className="text-sm text-gray-400">No experience entries yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
            <div className="flex items-start gap-3">
              <Briefcase className="mt-0.5 h-5 w-5 text-brand-400" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{e.title} · {e.company}</p>
                <p className="text-xs text-gray-500">
                  {[e.location, e.startDate ? `${e.startDate} – ${e.isCurrent ? "Present" : e.endDate ?? ""}` : null].filter(Boolean).join(" · ")}
                </p>
                {e.description && <p className="mt-1 text-xs text-gray-600">{e.description}</p>}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => deleteExperienceAction(e.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {open && (
          <form action={async (fd) => { const r = await formAction(fd); setOpen(false); return r; }} className="grid gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4 md:grid-cols-2">
            <Input name="company" placeholder="Company *" required />
            <Input name="title" placeholder="Job title *" required />
            <Input name="location" placeholder="Location" />
            <div className="flex gap-3">
              <Input name="startDate" placeholder="Start (e.g. Jan 2022)" />
              <Input name="endDate" placeholder="End" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
              <input type="checkbox" name="isCurrent" className="h-4 w-4 rounded border-gray-300" /> I currently work here
            </label>
            <Textarea name="description" rows={2} placeholder="What did you achieve?" className="md:col-span-2" />
            <div className="md:col-span-2">
              <Button size="sm" type="submit" loading={pending}>Save experience</Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ Company profile ------------------------------ */

type CompanyValues = {
  name: string; tagline: string; description: string; website: string; industry: string; size: string; location: string; foundedYear: string;
};

export function CompanyForm({ company }: { company: Company | null }) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(updateCompanyAction, {});
  const { register } = useForm<CompanyValues>({
    defaultValues: {
      name: company?.name ?? "",
      tagline: company?.tagline ?? "",
      description: company?.description ?? "",
      website: company?.website ?? "",
      industry: company?.industry ?? "",
      size: company?.size ?? "",
      location: company?.location ?? "",
      foundedYear: company?.foundedYear != null ? String(company.foundedYear) : "",
    },
  });
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction}>
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Company profile</h2>
          {state.success && <Badge tone="green">{state.success}</Badge>}
        </div>
        {state.error && <div className="mb-4"><Alert tone="error">{state.error}</Alert></div>}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Company name" required error={fe.name}><Input {...register("name")} name="name" /></Field>
          <Field label="Tagline" error={fe.tagline}><Input {...register("tagline")} name="tagline" placeholder="Building the future of…" /></Field>
          <Field label="Description" error={fe.description} className="md:col-span-2"><Textarea rows={4} {...register("description")} name="description" /></Field>
          <Field label="Website" error={fe.website}><Input {...register("website")} name="website" placeholder="https://…" /></Field>
          <Field label="Industry" error={fe.industry}><Input {...register("industry")} name="industry" placeholder="Software, Fintech…" /></Field>
          <Field label="Company size">
            <Select {...register("size")} name="size" defaultValue={company?.size ?? ""}>
              <option value="">Select</option>
              <option value="1-10">1–10</option><option value="11-50">11–50</option>
              <option value="51-200">51–200</option><option value="201-1000">201–1000</option><option value="1000+">1000+</option>
            </Select>
          </Field>
          <Field label="HQ location" error={fe.location}><Input {...register("location")} name="location" placeholder="Dhaka, Bangladesh" /></Field>
          <Field label="Founded year" error={fe.foundedYear}><Input type="number" {...register("foundedYear")} name="foundedYear" placeholder="2019" /></Field>
        </div>
        <Button type="submit" loading={pending} className="mt-5">Save company profile</Button>
      </Card>
    </form>
  );
}
