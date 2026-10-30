"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/lib/actions/auth";
import { Alert, Button, Card, CardHeader, Field, Input } from "@/components/ui";
import type { ActionState } from "@/lib/actions/auth";

export function ChangePasswordForm() {
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(changePasswordAction, {});
  return (
    <Card>
      <CardHeader title="Change password" subtitle="Sessions are rotated after a change" />
      <form action={formAction} className="max-w-md space-y-4 p-5">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.success && <Alert tone="success">{state.success}</Alert>}
        <Field label="Current password" required><Input name="current" type="password" autoComplete="current-password" required /></Field>
        <Field label="New password" required hint="8+ characters with a letter and a number"><Input name="password" type="password" autoComplete="new-password" required /></Field>
        <Button type="submit" loading={pending}>Update password</Button>
      </form>
    </Card>
  );
}

type Prefs = {
  inAppMessages: boolean; inAppApplications: boolean; inAppJobAlerts: boolean; inAppMembership: boolean;
  emailMessages: boolean; emailApplications: boolean; emailJobAlerts: boolean; emailMembership: boolean;
};

export function PreferencesForm({ prefs, saveAction }: { prefs: Prefs; saveAction: (formData: FormData) => Promise<{ error?: string; success?: string }> }) {
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const result = await saveAction(fd);
    setMessage(result.error ?? result.success ?? null);
    setBusy(false);
  }

  const rows: { key: keyof Prefs; label: string; hint: string }[] = [
    { key: "inAppMessages", label: "New messages", hint: "In-app alerts for incoming messages" },
    { key: "emailMessages", label: "Message emails", hint: "Email digest with a secure link to the conversation" },
    { key: "inAppApplications", label: "Application updates", hint: "Status changes, new applicants" },
    { key: "emailApplications", label: "Application emails", hint: "Emailed when application status changes" },
    { key: "inAppJobAlerts", label: "Job alerts", hint: "New jobs matching your interests" },
    { key: "emailJobAlerts", label: "Job alert emails", hint: "Periodic email digest" },
    { key: "emailMembership", label: "Membership & payment emails", hint: "Receipts, expiry warnings" },
  ];

  return (
    <Card>
      <CardHeader title="Notification preferences" subtitle="Applies immediately to future events" />
      <form onSubmit={submit} className="p-5">
        {message && <div className="mb-4"><Alert tone={message.includes("saved") ? "success" : "error"}>{message}</Alert></div>}
        <div className="divide-y divide-gray-100">
          {rows.map((row) => (
            <label key={row.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">{row.label}</p>
                <p className="text-xs text-gray-500">{row.hint}</p>
              </div>
              <input type="checkbox" name={row.key} defaultChecked={prefs[row.key]} className="h-5 w-5 rounded border-gray-300 text-brand-700" />
            </label>
          ))}
        </div>
        <Button type="submit" loading={busy} className="mt-4">Save preferences</Button>
      </form>
    </Card>
  );
}

export function MarkAllReadButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline" size="sm" loading={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
        router.refresh();
        setBusy(false);
      }}
    >
      Mark all as read
    </Button>
  );
}
