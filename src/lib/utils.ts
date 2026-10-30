import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function formatMoney(amount: number | null | undefined, currency = "BDT") {
  if (amount == null) return null;
  const formatted = new Intl.NumberFormat("en-US").format(amount);
  return currency === "BDT" ? `৳${formatted}` : `${currency} ${formatted}`;
}

export function formatSalary(
  min: number | null,
  max: number | null,
  currency = "BDT",
  period: string = "monthly"
) {
  if (!min && !max) return null;
  const suffix = period === "yearly" ? "/yr" : "/mo";
  if (min && max) return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}${suffix}`;
  if (min) return `From ${formatMoney(min, currency)}${suffix}`;
  return `Up to ${formatMoney(max, currency)}${suffix}`;
}

export function timeAgo(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDuration(totalSeconds: number | null | undefined) {
  if (totalSeconds == null) return "—";
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const minutes = totalSeconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(hours >= 10 ? 0 : 1)} hrs`;
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

export const WORKPLACE_LABELS: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "On-site",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior level",
  lead: "Lead",
  executive: "Executive",
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  viewed: "Viewed",
  shortlisted: "Shortlisted",
  interview: "Interview",
  rejected: "Rejected",
  hired: "Hired",
  withdrawn: "Withdrawn",
};

export function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
