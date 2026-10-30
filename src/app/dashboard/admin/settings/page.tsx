import { db } from "@/db";
import { membershipPlans, platformSettings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { DevGrantForm, SettingRow } from "@/components/admin-components";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform settings" };

export default async function AdminSettingsPage() {
  await requireRole("super_admin");
  const [settings, plans] = await Promise.all([
    db.select().from(platformSettings),
    db.select().from(membershipPlans).orderBy(membershipPlans.audience, membershipPlans.sortOrder),
  ]);
  const get = (key: string, fallback: string) => settings.find((s) => s.key === key)?.value ?? fallback;

  return (
    <DashboardShell active="/dashboard/admin/settings">
      <PageHeader title="Platform settings" subtitle="Super admin only — every change is audited." />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Video CV limits" subtitle="Enforced server-side on every upload" />
          <div className="space-y-5 p-5">
            <SettingRow
              settingKey="video_max_size_mb"
              label="Max video file size (MB)"
              value={get("video_max_size_mb", "50")}
              description="Currently served via direct browser playback; R2 has no built-in transcoding."
            />
            <SettingRow
              settingKey="video_max_duration_seconds"
              label="Max video duration (seconds)"
              value={get("video_max_duration_seconds", "120")}
              description="Validated when the video record is confirmed."
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Platform" />
          <div className="space-y-5 p-5">
            <SettingRow settingKey="platform_name" label="Platform name" value={get("platform_name", "TalentBridge")} />
            <SettingRow settingKey="allow_signups" label="Allow signups (true/false)" value={get("allow_signups", "true")} />
            <SettingRow settingKey="maintenance_notice" label="Maintenance notice (empty = off)" value={get("maintenance_notice", "")} />
          </div>
        </Card>

        <DevGrantForm plans={plans.filter((p) => p.priceMonthly > 0)} />

        <Card>
          <CardHeader title="Environment status" />
          <div className="space-y-2 p-5 text-xs text-gray-600">
            <EnvRow name="Transactional email (RESEND_API_KEY)" set={!!process.env.RESEND_API_KEY} />
            <EnvRow name="Cloudflare R2 object storage" set={!!process.env.R2_ACCOUNT_ID} />
            <EnvRow name="SSLCommerz merchant" set={!!(process.env.SSLCZ_STORE_ID && process.env.SSLCZ_STORE_PASSWORD)} />
            <EnvRow name="bKash merchant" set={!!(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET)} />
            <EnvRow name="Inbound email relay" set={!!(process.env.INBOUND_EMAIL_DOMAIN && process.env.INBOUND_EMAIL_SECRET)} />
            <p className="pt-2 text-[11px] text-gray-400">Settings last updated {settings.length ? timeAgo(settings.map((s) => s.updatedAt).sort().reverse()[0]) : "never"}.</p>
          </div>
        </Card>

        {!process.env.UPLOAD_SIGNING_SECRET && (
          <Alert tone="warning">UPLOAD_SIGNING_SECRET is not set — a development default is used. Set it in production.</Alert>
        )}
      </div>
    </DashboardShell>
  );
}

function EnvRow({ name, set }: { name: string; set: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 py-1.5 last:border-0">
      <span>{name}</span>
      <span className={`font-bold ${set ? "text-emerald-600" : "text-amber-600"}`}>{set ? "configured" : "not configured"}</span>
    </div>
  );
}
