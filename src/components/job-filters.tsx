"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import type { JobCategory } from "@/db/schema";

export function JobSearchBar({ categories, compact }: { categories: JobCategory[]; compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  function submit(formData: FormData) {
    const search = new URLSearchParams();
    for (const key of ["q", "location", "category", "jobType", "workplace", "experience", "minSalary", "maxSalary", "sort"] as const) {
      const val = String(formData.get(key) ?? "").trim();
      if (val) search.set(key, val);
    }
    router.push(`/jobs?${search.toString()}`);
  }

  return (
    <form action={submit} className={compact ? "grid gap-3 md:grid-cols-4" : "grid gap-3 md:grid-cols-[2fr,1.5fr,1.2fr,auto]"}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input name="q" defaultValue={params.get("q") ?? ""} placeholder="Job title, keyword, or company" className="pl-10" />
      </div>
      <div className="relative">
        <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input name="location" defaultValue={params.get("location") ?? ""} placeholder="Location" className="pl-10" />
      </div>
      <Select name="category" defaultValue={params.get("category") ?? ""}>
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <Button type="submit" className="md:px-8">Search jobs</Button>
    </form>
  );
}

export function JobFilterPanel({ categories }: { categories: JobCategory[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(formData: FormData) {
    const search = new URLSearchParams(params.toString());
    search.delete("page");
    for (const key of ["jobType", "workplace", "experience", "minSalary", "maxSalary", "sort"] as const) {
      const val = String(formData.get(key) ?? "").trim();
      if (val) search.set(key, val);
      else search.delete(key);
    }
    router.push(`/jobs?${search.toString()}`);
  }

  return (
    <form action={apply} className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">Job type</p>
        <Select name="jobType" defaultValue={params.get("jobType") ?? ""}>
          <option value="">Any</option>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="internship">Internship</option>
          <option value="temporary">Temporary</option>
        </Select>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">Workplace</p>
        <Select name="workplace" defaultValue={params.get("workplace") ?? ""}>
          <option value="">Any</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="on_site">On-site</option>
        </Select>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">Experience</p>
        <Select name="experience" defaultValue={params.get("experience") ?? ""}>
          <option value="">Any</option>
          <option value="entry">Entry level</option>
          <option value="mid">Mid level</option>
          <option value="senior">Senior level</option>
          <option value="lead">Lead</option>
          <option value="executive">Executive</option>
        </Select>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">Salary range (BDT/mo)</p>
        <div className="flex gap-2">
          <Input name="minSalary" type="number" min={0} placeholder="Min" defaultValue={params.get("minSalary") ?? ""} />
          <Input name="maxSalary" type="number" min={0} placeholder="Max" defaultValue={params.get("maxSalary") ?? ""} />
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">Sort by</p>
        <Select name="sort" defaultValue={params.get("sort") ?? "newest"}>
          <option value="newest">Newest first</option>
          <option value="salary">Highest salary</option>
        </Select>
      </div>
      <Button type="submit" variant="secondary" className="w-full">Apply filters</Button>
    </form>
  );
}

export function Pagination({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function go(next: number) {
    const search = new URLSearchParams(params.toString());
    if (next <= 1) search.delete("page");
    else search.set("page", String(next));
    router.push(`/jobs?${search.toString()}`);
  }

  if (pageCount <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-between">
      <p className="text-xs text-gray-500">{total} job{total === 1 ? "" : "s"} found · page {page} of {pageCount}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => go(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
