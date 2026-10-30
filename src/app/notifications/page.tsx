import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { MarkAllReadButton } from "@/components/settings-forms";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(60);

  return (
    <DashboardShell active="/notifications">
      <PageHeader title="Notification center" subtitle="In-app alerts — email preferences live in Settings" actions={<MarkAllReadButton />} />
      {rows.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" body="Application updates, messages and membership events will show up here." />
      ) : (
        <Card>
          <div className="divide-y divide-gray-50">
            {rows.map((n) => (
              <Link key={n.id} href={n.url ?? "/notifications"} className={`flex items-start gap-3 px-5 py-4 transition hover:bg-brand-50/50 ${!n.isRead ? "bg-blue-50/40" : ""}`}>
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-gray-200" : "bg-accent-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.isRead ? "text-gray-700" : "font-bold text-gray-900"}`}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-gray-500">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-gray-400">{timeAgo(n.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}
