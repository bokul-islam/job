import { desc } from "drizzle-orm";
import { ExternalLink, Mail } from "lucide-react";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { Alert, Badge, Card, EmptyState, PageHeader, STATUS_TONES } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mail outbox (development)" };

export default async function OutboxPage() {
  await requireRole("super_admin", "admin");
  const rows = await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(50);
  const devMode = !process.env.RESEND_API_KEY;

  return (
    <DashboardShell active="/dashboard/admin/outbox">
      <PageHeader title="Mail outbox" subtitle="Every outbound email is recorded here — in development, this outbox is the delivery." />
      {devMode && (
        <div className="mb-5">
          <Alert tone="info">
            Development mode: no email provider key is configured (<code>RESEND_API_KEY</code>). Messages below were logged
            instead of sent. Links inside messages remain clickable. To enable real delivery, add a Resend API key.
          </Alert>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={<Mail className="h-6 w-6" />} title="Outbox is empty" body="Verification, notification and payment emails will be logged here." />
      ) : (
        <Card>
          <div className="divide-y divide-gray-100">
            {rows.map((mail) => {
              const link = extractLink(mail.body);
              return (
                <div key={mail.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900">{mail.subject}</p>
                    <Badge tone={mail.status === "sent" ? "green" : mail.status === "failed" ? "red" : "amber"}>{mail.status === "logged" ? "dev-logged" : mail.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">to {mail.toEmail} · {mail.template} · {timeAgo(mail.createdAt)}</p>
                  {link && (
                    <a href={link} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100">
                      <ExternalLink className="h-3 w-3" /> Open action link
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}

function extractLink(html: string): string | null {
  const match = html.match(/href="([^"]+)"/);
  return match?.[1] ?? null;
}
