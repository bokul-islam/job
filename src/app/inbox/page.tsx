import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { conversationParticipants } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { inboxFor } from "@/lib/queries";
import { DashboardShell } from "@/components/dashboard-shell";
import { Inbox, type InboxItem } from "@/components/inbox";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const rows = await inboxFor(user.id);

  const items: InboxItem[] = await Promise.all(
    rows.map(async (r) => {
      const otherParticipant = (
        await db
          .select()
          .from(conversationParticipants)
          .where(and(eq(conversationParticipants.conversationId, r.conversation.id), ne(conversationParticipants.userId, user.id)))
          .limit(1)
      )[0];
      return {
        conversationId: r.conversation.id,
        otherUserId: r.other?.id ?? "",
        otherName: r.other?.name ?? "Unknown user",
        otherRole: r.other?.role ?? "",
        lastMessage: r.lastMessage?.body ?? null,
        lastMessageAt: new Date(r.conversation.lastMessageAt).toISOString(),
        unread: r.unread,
        iBlockedThem: otherParticipant?.blocked ?? false,
      };
    })
  );

  return (
    <DashboardShell active="/inbox">
      <PageHeader title="Inbox" subtitle="Live syncing every few seconds. Response times are tracked for accountability." />
      <Inbox items={items} currentUserId={user.id} activeId={sp.c} />
    </DashboardShell>
  );
}
