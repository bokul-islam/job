"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { createJobAction, updateJobAction } from "@/lib/actions/jobs";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import type { Job, JobCategory } from "@/db/schema";
import type { ActionState } from "@/lib/actions/auth";

type FormValues = {
  title: string; categoryId: string; jobType: string; workplaceType: string; experienceLevel: string;
  location: string; salaryMin: string; salaryMax: string; salaryPeriod: string;
  description: string; responsibilities: string; requirements: string; benefits: string;
  vacancies: number; deadline: string; skillNames: string; allowReapply: boolean;
};

export function JobForm({ categories, job, skillNames }: { categories: JobCategory[]; job?: Job; skillNames?: string }) {
  const boundAction = job ? updateJobAction.bind(null, job.id) : createJobAction;
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(boundAction, {});
  const [intent, setIntent] = React.useState<"draft" | "publish">("draft");

  const { register } = useForm<FormValues>({
    defaultValues: {
      title: job?.title ?? "",
      categoryId: job?.categoryId ?? "",
      jobType: job?.jobType ?? "full_time",
      workplaceType: job?.workplaceType ?? "on_site",
      experienceLevel: job?.experienceLevel ?? "mid",
      location: job?.location ?? "",
      salaryMin: job?.salaryMin != null ? String(job.salaryMin) : "",
      salaryMax: job?.salaryMax != null ? String(job.salaryMax) : "",
      salaryPeriod: job?.salaryPeriod ?? "monthly",
      description: job?.description ?? "",
      responsibilities: job?.responsibilities ?? "",
      requirements: job?.requirements ?? "",
      benefits: job?.benefits ?? "",
      vacancies: job?.vacancies ?? 1,
      deadline: job?.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : "",
      skillNames: skillNames ?? "",
      allowReapply: job?.allowReapply ?? false,
    },
  });
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="action" value={intent} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">Role basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Job title" required error={fe.title} className="md:col-span-2">
            <Input {...register("title")} name="title" placeholder="e.g. Senior Frontend Engineer" />
          </Field>
          <Field label="Category" error={fe.categoryId}>
            <Select {...register("categoryId")} name="categoryId">
              <option value="">Select a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Location" required error={fe.location}>
            <Input {...register("location")} name="location" placeholder="Dhaka, Bangladesh" />
          </Field>
          <Field label="Job type">
            <Select {...register("jobType")} name="jobType">
              <option value="full_time">Full-time</option><option value="part_time">Part-time</option>
              <option value="contract">Contract</option><option value="internship">Internship</option>
              <option value="temporary">Temporary</option>
            </Select>
          </Field>
          <Field label="Workplace">
            <Select {...register("workplaceType")} name="workplaceType">
              <option value="on_site">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
            </Select>
          </Field>
          <Field label="Experience level">
            <Select {...register("experienceLevel")} name="experienceLevel">
              <option value="entry">Entry level</option><option value="mid">Mid level</option>
              <option value="senior">Senior level</option><option value="lead">Lead</option><option value="executive">Executive</option>
            </Select>
          </Field>
          <Field label="Vacancies">
            <Input type="number" min={1} {...register("vacancies")} name="vacancies" />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">Compensation & deadline</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Min salary (BDT)" error={fe.salaryMin}>
            <Input type="number" min={0} {...register("salaryMin")} name="salaryMin" placeholder="60000" />
          </Field>
          <Field label="Max salary (BDT)" error={fe.salaryMax}>
            <Input type="number" min={0} {...register("salaryMax")} name="salaryMax" placeholder="120000" />
          </Field>
          <Field label="Period">
            <Select {...register("salaryPeriod")} name="salaryPeriod">
              <option value="monthly">Per month</option><option value="yearly">Per year</option>
            </Select>
          </Field>
          <Field label="Application deadline" hint="Optional">
            <Input type="date" {...register("deadline")} name="deadline" />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">Details</h2>
        <div className="space-y-4">
          <Field label="Job description" required error={fe.description}>
            <Textarea rows={6} {...register("description")} name="description" placeholder="Describe the role, team and impact…" />
          </Field>
          <Field label="Responsibilities" hint="One per line">
            <Textarea rows={4} {...register("responsibilities")} name="responsibilities" />
          </Field>
          <Field label="Requirements" hint="One per line">
            <Textarea rows={4} {...register("requirements")} name="requirements" />
          </Field>
          <Field label="Benefits" hint="One per line">
            <Textarea rows={3} {...register("benefits")} name="benefits" />
          </Field>
          <Field label="Required skills" hint="Comma separated, e.g. React, TypeScript, Node.js">
            <Input {...register("skillNames")} name="skillNames" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-gray-700">
            <input type="checkbox" {...register("allowReapply")} name="allowReapply" value="true" className="h-4 w-4 rounded border-gray-300 text-brand-700" />
            Allow candidates who withdrew to reapply
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="outline" loading={pending && intent === "draft"} onClick={() => setIntent("draft")}>
          {job ? "Save" : "Save as draft"}
        </Button>
        <Button type="submit" loading={pending && intent === "publish"} onClick={() => setIntent("publish")}>
          {job?.status === "active" ? "Save & keep published" : "Save & publish"}
        </Button>
      </div>
    </form>
  );
}
