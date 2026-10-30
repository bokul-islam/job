"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { Building2, UserRound } from "lucide-react";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/lib/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Email address" required>
        <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </Field>
      <Field label="Password" required>
        <Input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
      </Field>
      <Button type="submit" loading={pending} className="w-full" size="lg">Sign in</Button>
      <div className="flex items-center justify-between text-xs">
        <Link href="/auth/forgot" className="font-semibold text-brand-600 hover:text-brand-800">Forgot password?</Link>
        <Link href={`/auth/register${next ? `?next=${next}` : ""}`} className="font-semibold text-brand-600 hover:text-brand-800">Create account</Link>
      </div>
    </form>
  );
}

export function RegisterForm({ defaultRole }: { defaultRole: "job_seeker" | "employer" }) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(registerAction, {});
  const [role, setRole] = React.useState(defaultRole);
  const { register } = useForm();
  const fe = state.fieldErrors ?? {};

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <RoleCard active={role === "job_seeker"} onClick={() => setRole("job_seeker")} icon={<UserRound className="h-5 w-5" />} title="Job seeker" desc="Find work" />
        <RoleCard active={role === "employer"} onClick={() => setRole("employer")} icon={<Building2 className="h-5 w-5" />} title="Employer" desc="Hire talent" />
      </div>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="role" value={role} />
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Field label="Full name" required error={fe.name}>
          <Input {...register("name")} name="name" autoComplete="name" placeholder="Jane Rahman" required />
        </Field>
        {role === "employer" && (
          <Field label="Company name" required error={fe.companyName}>
            <Input name="companyName" placeholder="Acme Technologies" required />
          </Field>
        )}
        <Field label="Email address" required error={fe.email}>
          <Input {...register("email")} name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        </Field>
        <Field label="Password" required error={fe.password} hint="8+ characters with a letter and a number">
          <Input {...register("password")} name="password" type="password" autoComplete="new-password" placeholder="••••••••" required />
        </Field>
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-gray-600">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
          <span>I agree to the <Link href="/terms" className="font-semibold text-brand-700">Terms</Link> and <Link href="/privacy" className="font-semibold text-brand-700">Privacy policy</Link>.</span>
        </label>
        {fe.acceptTerms && <p className="text-xs font-medium text-red-600">{fe.acceptTerms[0]}</p>}
        <Button type="submit" loading={pending} className="w-full" size="lg">
          {role === "employer" ? "Create employer account" : "Create job seeker account"}
        </Button>
      </form>
    </div>
  );
}

function RoleCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("rounded-2xl border-2 p-4 text-left transition", active ? "border-brand-600 bg-brand-50 shadow-sm" : "border-gray-200 hover:border-brand-200")}>
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-brand-900 text-accent-300" : "bg-gray-100 text-gray-500")}>{icon}</span>
      <p className="mt-2.5 text-sm font-bold text-gray-900">{title}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </button>
  );
}

export function ForgotForm() {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(forgotPasswordAction, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Field label="Email address" required>
        <Input name="email" type="email" placeholder="you@example.com" required />
      </Field>
      <Button type="submit" loading={pending} className="w-full" size="lg">Send reset link</Button>
      <p className="text-center text-xs text-gray-400">
        Development mode: the reset link appears in the admin mail outbox and server console.
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(resetPasswordAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="New password" required hint="8+ characters with a letter and a number">
        <Input name="password" type="password" autoComplete="new-password" placeholder="••••••••" required />
      </Field>
      <Button type="submit" loading={pending} className="w-full" size="lg">Reset password</Button>
    </form>
  );
}
