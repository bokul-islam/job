import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn, initials } from "@/lib/utils";

/* --------------------------------- Buttons --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-900 text-white hover:bg-brand-800 shadow-sm",
  secondary: "bg-brand-50 text-brand-900 hover:bg-brand-100 border border-brand-100",
  outline: "border border-gray-300 bg-white text-gray-800 hover:border-brand-300 hover:text-brand-900 shadow-sm",
  ghost: "text-gray-600 hover:bg-brand-50 hover:text-brand-900",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  accent: "bg-accent-500 text-white hover:bg-accent-600 shadow-sm",
};

export function Button({
  className, variant = "primary", size = "md", loading, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        buttonVariants[variant],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {props.children}
    </button>
  );
}

export function LinkButton({
  href, className, variant = "primary", size = "md", children, ...rest
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all hover:-translate-y-px",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        buttonVariants[variant],
        className
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

/* ---------------------------------- Inputs ---------------------------------- */

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full appearance-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-semibold text-gray-700", className)} {...props} />;
}

export function Field({
  label, error, hint, children, className, required,
}: { label: string; error?: string | string[]; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {hint && !message && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {message && <p className="mt-1 text-xs font-medium text-red-600">{message}</p>}
    </div>
  );
}

/* ---------------------------------- Cards ---------------------------------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-gray-200/80 bg-white shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function CardHeader({ title, subtitle, action, className }: { title: string; subtitle?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4", className)}>
      <div>
        <h2 className="text-[15px] font-bold text-brand-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------------------------- Badges ---------------------------------- */

type BadgeTone = "gray" | "green" | "blue" | "amber" | "red" | "navy" | "purple" | "teal";
const badgeTones: Record<BadgeTone, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-1 ring-red-200",
  navy: "bg-brand-50 text-brand-800 ring-1 ring-brand-200",
  purple: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  teal: "bg-accent-50 text-accent-700 ring-1 ring-accent-200",
};

export function Badge({ tone = "gray", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export const STATUS_TONES: Record<string, BadgeTone> = {
  submitted: "blue",
  viewed: "gray",
  shortlisted: "purple",
  interview: "amber",
  rejected: "red",
  hired: "green",
  withdrawn: "gray",
  active: "green",
  paused: "amber",
  closed: "gray",
  draft: "gray",
  open: "red",
  reviewing: "amber",
  resolved: "green",
  dismissed: "gray",
  completed: "green",
  failed: "red",
  initiated: "amber",
  pending: "amber",
  canceled: "gray",
  expired: "gray",
};

/* ---------------------------------- Avatar ---------------------------------- */

const avatarPalette = ["bg-brand-800", "bg-accent-600", "bg-violet-600", "bg-rose-600", "bg-emerald-700", "bg-amber-600"];

export function Avatar({ name, className, size = "md" }: { name: string; className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const color = avatarPalette[(name.charCodeAt(0) || 0) % avatarPalette.length];
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        size === "sm" && "h-8 w-8 text-[10px]",
        size === "md" && "h-10 w-10 text-xs",
        size === "lg" && "h-14 w-14 text-base",
        size === "xl" && "h-20 w-20 text-xl",
        color,
        className
      )}
    >
      {initials(name)}
    </div>
  );
}

/* ---------------------------------- States ---------------------------------- */

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: React.ReactNode }) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">{icon}</div>}
      <h3 className="text-sm font-bold text-brand-900">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-xs text-gray-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone = "navy" }: { label: string; value: React.ReactNode; sub?: string; icon?: React.ReactNode; tone?: "navy" | "green" | "amber" | "teal" | "purple" }) {
  const tones = {
    navy: "bg-brand-50 text-brand-800",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    teal: "bg-accent-50 text-accent-700",
    purple: "bg-violet-50 text-violet-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        {icon && <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>{icon}</span>}
      </div>
      <p className="mt-2 text-[28px] font-extrabold leading-none text-brand-950">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-gray-500">{sub}</p>}
    </Card>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-gray-100", className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand-600", className)} />;
}
