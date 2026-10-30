import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, paymentWebhookEvents } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit logs" };

export default async function AdminLogsPage() {
  await requireRole("super_admin", "admin");
  const [logs, webhooks] = await Promise.all([
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(60),
    db.select().from(paymentWebhookEvents).orderBy(desc(paymentWebhookEvents.createdAt)).limit(20),
  ]);

  return (
    <DashboardShell active="/dashboard/admin/logs">
      <PageHeader title="Audit & webhook logs" subtitle="Sensitive actions and payment events, immutable and timestamped." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Audit log" />
          <div className="max-h-[560px] divide-y divide-gray-50 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-gray-800">{log.action}</p>
                  <p className="shrink-0 text-[10px] text-gray-400">{timeAgo(log.createdAt)}</p>
                </div>
                <p className="text-[11px] text-gray-500">
                  {log.targetType ?? ""} {log.targetId ? <span className="font-mono">{log.targetId.slice(0, 8)}…</span> : ""}
                </p>
              </div>
            ))}
            {logs.length === 0 && <p className="p-5 text-sm text-gray-400">No audit entries yet.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment webhook events" subtitle="Idempotent processing — duplicate deliveries are deduplicated" />
          <div className="max-h-[560px] divide-y divide-gray-50 overflow-y-auto">
            {webhooks.map((w) => (
              <div key={w.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-semibold text-gray-800">{w.eventId}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={w.signatureOk ? "green" : "red"}>{w.signatureOk ? "signature ok" : "rejected"}</Badge>
                    <p className="text-[10px] text-gray-400">{timeAgo(w.createdAt)}</p>
                  </div>
                </div>
                <p className="text-[11px] capitalize text-gray-500">{w.provider} · {w.processedAt ? "processed" : "recorded"}</p>
              </div>
            ))}
            {webhooks.length === 0 && <p className="p-5 text-sm text-gray-400">No webhook events yet.</p>}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
