"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { ShieldCheck, Flag, FlagOff, Ban, CheckCircle2 } from "lucide-react";
import {
  moderateJobAction, resolveReportAction, setUserRoleAction, setUserStatusAction, updateSettingAction, upsertPlanAction,
} from "@/lib/actions/admin";
import { devGrantMembershipAction } from "@/lib/actions/membership";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import type { MembershipPlan, PlanEntitlement, Report } from "@/db/schema";
import type { ActionState } from "@/lib/actions/auth";

export function UserStatusControls({ userId, status, role, viewerRole, isSelf }: {
  userId: string; status: string; role: string; viewerRole: string; isSelf: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  if (isSelf) return <Badge tone="gray">You</Badge>;
  const canManage = viewerRole === "super_admin" || (viewerRole === "admin" && !["admin", "super_admin"].includes(role));
  if (!canManage) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <Button size="sm" variant="danger" loading={busy} onClick={async () => { setBusy(true); await setUserStatusAction(userId, "suspended"); setBusy(false); }}>
          <Ban className="h-3.5 w-3.5" /> Suspend
        </Button>
      ) : (
        <Button size="sm" variant="accent" loading={busy} onClick={async () => { setBusy(true); await setUserStatusAction(userId, "active"); setBusy(false); }}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate
        </Button>
      )}
      {viewerRole === "super_admin" && (
        <Button size="sm" variant="outline" loading={busy}
          onClick={async () => { setBusy(true); await setUserRoleAction(userId, role === "admin" ? "job_seeker" : "admin"); setBusy(false); }}>
          {role === "admin" ? "Revoke admin" : "Make admin"}
        </Button>
      )}
    </div>
  );
}

export function JobModerationControls({ jobId, flagged, status }: { jobId: string; flagged: boolean; status: string }) {
  const [busy, setBusy] = React.useState(false);
  async function act(action: "flag" | "unflag" | "close") {
    setBusy(true);
    await moderateJobAction(jobId, action);
    setBusy(false);
  }
  return (
    <div className="flex gap-2">
      {flagged ? (
        <Button size="sm" variant="outline" loading={busy} onClick={() => act("unflag")}><FlagOff className="h-3.5 w-3.5" /> Unflag</Button>
      ) : (
        <Button size="sm" variant="outline" loading={busy} onClick={() => act("flag")}><Flag className="h-3.5 w-3.5" /> Flag</Button>
      )}
      {status !== "closed" && <Button size="sm" variant="danger" loading={busy} onClick={() => act("close")}>Force close</Button>}
    </div>
  );
}

export function ReportResolver({ report }: { report: Report }) {
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function resolve(status: "resolved" | "dismissed") {
    setBusy(true);
    await resolveReportAction(report.id, status, note);
    setBusy(false);
  }
  if (report.status === "resolved" || report.status === "dismissed") {
    return <p className="text-xs text-gray-500">{report.resolutionNote ? `Note: ${report.resolutionNote}` : "Closed"}</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (optional)" />
      <div className="flex gap-2">
        <Button size="sm" variant="accent" loading={busy} onClick={() => resolve("resolved")}><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</Button>
        <Button size="sm" variant="outline" loading={busy} onClick={() => resolve("dismissed")}>Dismiss</Button>
      </div>
    </div>
  );
}

/* --------------------------------- Plan editor --------------------------------- */

type PlanValues = {
  name: string; audience: string; priceMonthly: string; priceYearly: string; description: string; features: string; isActive: boolean;
  applications_per_month: string; active_job_posts: string; messages_per_day: string; candidate_searches_per_day: string;
  video_cv: boolean; featured_candidate: boolean; advanced_analytics: boolean; featured_jobs: boolean;
};

export function PlanEditor({ plan, entitlements }: { plan?: MembershipPlan; entitlements?: PlanEntitlement[] }) {
  const bound = upsertPlanAction.bind(null, plan?.id ?? null);
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(bound, {});
  const ent = (key: string) => entitlements?.find((e) => e.key === key);
  const { register } = useForm<PlanValues>({
    defaultValues: {
      name: plan?.name ?? "",
      audience: plan?.audience ?? "job_seeker",
      priceMonthly: plan ? String(plan.priceMonthly) : "0",
      priceYearly: plan ? String(plan.priceYearly) : "0",
      description: plan?.description ?? "",
      features: (plan?.features ?? []).join("\n"),
      isActive: plan?.isActive ?? true,
      applications_per_month: ent("applications_per_month")?.valueInt != null ? String(ent("applications_per_month")!.valueInt) : "",
      active_job_posts: ent("active_job_posts")?.valueInt != null ? String(ent("active_job_posts")!.valueInt) : "",
      messages_per_day: ent("messages_per_day")?.valueInt != null ? String(ent("messages_per_day")!.valueInt) : "",
      candidate_searches_per_day: ent("candidate_searches_per_day")?.valueInt != null ? String(ent("candidate_searches_per_day")!.valueInt) : "",
      video_cv: ent("video_cv")?.valueBool ?? false,
      featured_candidate: ent("featured_candidate")?.valueBool ?? false,
      advanced_analytics: ent("advanced_analytics")?.valueBool ?? false,
      featured_jobs: ent("featured_jobs")?.valueBool ?? false,
    },
  });

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.success && <Alert tone="success">{state.success}</Alert>}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Plan name" required error={state.fieldErrors?.name}><Input {...register("name")} name="name" /></Field>
          <Field label="Audience">
            <Select {...register("audience")} name="audience">
              <option value="job_seeker">Job seeker</option><option value="employer">Employer</option>
            </Select>
          </Field>
          <Field label="Price — monthly (BDT)"><Input type="number" min={0} {...register("priceMonthly")} name="priceMonthly" /></Field>
          <Field label="Price — yearly (BDT)"><Input type="number" min={0} {...register("priceYearly")} name="priceYearly" /></Field>
        </div>
        <Field label="Description"><Input {...register("description")} name="description" /></Field>
        <Field label="Marketing features" hint="One per line — shown on the pricing page">
          <Textarea rows={3} {...register("features")} name="features" />
        </Field>
        <p className="pt-1 text-xs font-bold uppercase tracking-wider text-gray-500">Entitlements (enforced server-side)</p>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Applications / month"><Input type="number" min={0} {...register("applications_per_month")} name="applications_per_month" /></Field>
          <Field label="Active job posts"><Input type="number" min={0} {...register("active_job_posts")} name="active_job_posts" /></Field>
          <Field label="Messages / day"><Input type="number" min={0} {...register("messages_per_day")} name="messages_per_day" /></Field>
          <Field label="Candidate searches / day"><Input type="number" min={0} {...register("candidate_searches_per_day")} name="candidate_searches_per_day" /></Field>
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" {...register("video_cv")} name="video_cv" value="true" className="h-4 w-4 rounded" /> Video CV</label>
          <label className="flex items-center gap-2"><input type="checkbox" {...register("featured_candidate")} name="featured_candidate" value="true" className="h-4 w-4 rounded" /> Featured candidate</label>
          <label className="flex items-center gap-2"><input type="checkbox" {...register("advanced_analytics")} name="advanced_analytics" value="true" className="h-4 w-4 rounded" /> Advanced analytics</label>
          <label className="flex items-center gap-2"><input type="checkbox" {...register("featured_jobs")} name="featured_jobs" value="true" className="h-4 w-4 rounded" /> Featured jobs</label>
          <label className="flex items-center gap-2"><input type="checkbox" {...register("isActive")} name="isActive" value="true" className="h-4 w-4 rounded" /> Plan is purchasable</label>
        </div>
        <Button type="submit" loading={pending}><ShieldCheck className="h-4 w-4" /> Save plan</Button>
      </form>
    </Card>
  );
}

/* ------------------------------- Settings (super) ------------------------------ */

export function SettingRow({ settingKey, label, value, description }: { settingKey: string; label: string; value: string; description?: string }) {
  const [val, setVal] = React.useState(value);
  const [saved, setSaved] = React.useState(false);
  return (
    <div className="grid items-end gap-2 md:grid-cols-[1fr,220px,auto]">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <Input value={val} onChange={(e) => { setVal(e.target.value); setSaved(false); }} />
      <Button size="sm" variant={saved ? "secondary" : "primary"} onClick={async () => { await updateSettingAction(settingKey, val); setSaved(true); }}>
        {saved ? "Saved" : "Save"}
      </Button>
    </div>
  );
}

export function DevGrantForm({ plans }: { plans: MembershipPlan[] }) {
  const [email, setEmail] = React.useState("");
  const [plan, setPlan] = React.useState(plans[0]?.slug ?? "");
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <Card>
      <CardHeader title="Development membership grant" subtitle="Super admin only — clearly separated from real payments (৳0 sandbox record)" />
      <div className="space-y-3 p-5">
        {message && <Alert tone={message.startsWith("Error") ? "error" : "info"}>{message}</Alert>}
        <div className="grid gap-3 md:grid-cols-[1fr,220px,auto]">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
            {plans.map((p) => <option key={p.id} value={p.slug}>{p.name} ({p.audience})</option>)}
          </Select>
          <Button loading={busy} size="sm" onClick={async () => {
            setBusy(true);
            const result = await devGrantMembershipAction(email, plan, "monthly");
            setMessage(result.error ? `Error: ${result.error}` : result.success ?? "Granted.");
            setBusy(false);
          }}>Grant</Button>
        </div>
      </div>
    </Card>
  );
}
