import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { latestMessages, markConversationReadAction } from "@/lib/actions/messaging";
import { inboxFor } from "@/lib/queries";

/** Polling endpoint for the live inbox (swap for Supabase Realtime in production). */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.status !== "active") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("c");

  if (!conversationId) {
    const inbox = await inboxFor(user.id);
    return NextResponse.json({ inbox });
  }

  const rows = await latestMessages(conversationId, user.id);
  await markConversationReadAction(conversationId);
  return NextResponse.json({
    messages: rows.map((r) => ({
      id: r.message.id,
      body: r.message.body,
      senderId: r.message.senderId,
      senderName: r.sender.name,
      createdAt: r.message.createdAt,
      attachment: r.message.attachmentKey
        ? { key: r.message.attachmentKey, name: r.message.attachmentName, size: r.message.attachmentSize }
        : null,
      isAutomated: r.message.isAutomated,
    })),
  });
}
