import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { ChangePasswordForm, PreferencesForm } from "@/components/settings-forms";
import { Card, CardHeader, PageHeader, Badge } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const prefs = (await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, user.id)).limit(1))[0];

  async function savePrefs(formData: FormData) {
    "use server";
    const current = await requireUser();
    const bool = (key: string) => formData.get(key) === "on";
    const values = {
      inAppMessages: bool("inAppMessages"),
      inAppApplications: bool("inAppApplications"),
      inAppJobAlerts: bool("inAppJobAlerts"),
      inAppMembership: bool("inAppMembership"),
      emailMessages: bool("emailMessages"),
      emailApplications: bool("emailApplications"),
      emailJobAlerts: bool("emailJobAlerts"),
      emailMembership: bool("emailMembership"),
    };
    await db
      .insert(notificationPreferences)
      .values({ userId: current.id, ...values })
      .onConflictDoUpdate({ target: notificationPreferences.userId, set: values });
    revalidatePath("/settings");
    return { success: "Preferences saved." };
  }

  return (
    <DashboardShell active="/settings">
      <PageHeader title="Account settings" subtitle="Security and communication preferences" />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChangePasswordForm />
        <Card>
          <CardHeader title="Account" />
          <div className="space-y-3 p-5 text-sm">
            <Row label="Email" value={user.email} />
            <Row label="Role" value={user.role.replace("_", " ")} />
            <Row label="Status" value={user.status} badge />
            <Row label="Email verified" value={user.emailVerifiedAt ? timeAgo(user.emailVerifiedAt) : "Not verified"} />
            <Row label="Member since" value={user.createdAt.toDateString()} />
            <Row label="Last active" value={timeAgo(user.lastActiveAt)} />
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <PreferencesForm
          prefs={prefs ?? {
            inAppMessages: true, inAppApplications: true, inAppJobAlerts: true, inAppMembership: true,
            emailMessages: true, emailApplications: true, emailJobAlerts: false, emailMembership: true,
          }}
          saveAction={savePrefs}
        />
      </div>
    </DashboardShell>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-2.5 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      {badge ? <Badge tone={value === "active" ? "green" : "red"} className="capitalize">{value}</Badge> : <span className="font-semibold capitalize text-gray-800">{value}</span>}
    </div>
  );
}
