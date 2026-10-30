"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, CheckCheck, FileIcon, Paperclip, SendHorizonal, ShieldOff } from "lucide-react";
import { sendMessageAction, setBlockAction, submitReportAction } from "@/lib/actions/messaging";
import { Avatar, Badge, Button, EmptyState } from "@/components/ui";
import { formatBytes, timeAgo } from "@/lib/utils";

export type InboxItem = {
  conversationId: string;
  otherUserId: string;
  otherName: string;
  otherRole: string;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
  iBlockedThem: boolean;
};

type MessageItem = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  attachment: { key: string; name: string | null; size: number | null } | null;
  isAutomated: boolean;
};

export function Inbox({ items, currentUserId, activeId }: { items: InboxItem[]; currentUserId: string; activeId?: string }) {
  const router = useRouter();
  const active = activeId ? items.find((i) => i.conversationId === activeId) : undefined;

  return (
    <div className="grid overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[var(--shadow-card)] md:grid-cols-[320px,1fr]" style={{ height: "calc(100vh - 170px)", minHeight: 520 }}>
      <div className={`flex flex-col border-r border-gray-100 ${activeId ? "hidden md:flex" : "flex"}`}>
        <div className="border-b border-gray-100 px-4 py-3.5">
          <h2 className="text-sm font-bold text-brand-900">Conversations</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && (
            <div className="p-4">
              <EmptyState title="No conversations yet" body="Messages between you and employers/candidates will appear here." />
            </div>
          )}
          {items.map((item) => (
            <button
              key={item.conversationId}
              onClick={() => router.push(`/inbox?c=${item.conversationId}`)}
              className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3.5 text-left transition hover:bg-brand-50/60 ${
                activeId === item.conversationId ? "bg-brand-50" : ""
              }`}
            >
              <Avatar name={item.otherName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-bold text-gray-900">{item.otherName}</p>
                  <span className="shrink-0 text-[10px] text-gray-400">{timeAgo(item.lastMessageAt)}</span>
                </div>
                <p className="truncate text-xs text-gray-500">{item.lastMessage ?? "Start the conversation"}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge tone="gray">{item.otherRole === "employer" ? "Employer" : "Candidate"}</Badge>
                  {item.iBlockedThem && <Badge tone="red">You blocked them</Badge>}
                </div>
              </div>
              {item.unread > 0 && (
                <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">
                  {item.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={`flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
        {active ? (
          <Thread conversationId={active.conversationId} otherUserId={active.otherUserId} otherName={active.otherName} currentUserId={currentUserId} blocked={active.iBlockedThem} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState title="Select a conversation" body="Choose a conversation from the list to read and reply." />
          </div>
        )}
      </div>
    </div>
  );
}

function Thread({ conversationId, otherUserId, otherName, currentUserId, blocked }: {
  conversationId: string; otherUserId: string; otherName: string; currentUserId: string; blocked: boolean;
}) {
  const [messages, setMessages] = React.useState<MessageItem[]>([]);
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [isBlocked, setIsBlocked] = React.useState(blocked);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const attachRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?c=${conversationId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch { /* offline */ }
  }, [conversationId]);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send(attachment?: { key: string; name: string; size: number; mime: string }) {
    const text = body.trim();
    if (!text && !attachment) return;
    setSending(true);
    setError(null);
    const result = await sendMessageAction({ conversationId, body: text, attachment });
    setSending(false);
    if (result.error) setError(result.error);
    else {
      setBody("");
      load();
    }
  }

  async function attachFile(file: File) {
    if (file.size > 10 * 1024 * 1024) { setError("Attachment exceeds 10 MB."); return; }
    const presign = await (await fetch("/api/uploads/presign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "attachment", fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size }),
    })).json();
    if (presign.error) { setError(presign.error); return; }
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presign.url);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject());
      xhr.onerror = () => reject();
      xhr.send(file);
    }).catch(() => setError("Attachment upload failed."));
    await send({ key: presign.key, name: file.name, size: file.size, mime: file.type });
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={otherName} size="sm" />
          <p className="text-sm font-bold text-gray-900">{otherName}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => { await setBlockAction(conversationId, !isBlocked); setIsBlocked(!isBlocked); }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition hover:bg-red-50 hover:text-red-600"
            title={isBlocked ? "Unblock" : "Block this user"}
          >
            {isBlocked ? <ShieldOff className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            {isBlocked ? "Unblock" : "Block"}
          </button>
          <button
            onClick={async () => {
              const reason = window.prompt("Why are you reporting this user?");
              if (!reason || reason.trim().length < 3) return;
              const result = await submitReportAction({ targetType: "user", targetId: otherUserId, reason: reason.trim(), details: `Reported from conversation ${conversationId}` });
              window.alert(result.error ?? "Report submitted. Our moderation team will review it.");
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition hover:bg-amber-50 hover:text-amber-600"
          >
            <AlertTriangle className="h-4 w-4" /> Report
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafd] px-4 py-4">
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${mine ? "rounded-br-md bg-brand-900 text-white" : "rounded-bl-md border border-gray-100 bg-white text-gray-800"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {m.attachment && (
                  <a
                    href={`/api/files/${m.attachment.key}`}
                    target="_blank"
                    className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold ${mine ? "bg-white/10 text-white" : "bg-brand-50 text-brand-800"}`}
                  >
                    <FileIcon className="h-4 w-4" /> {m.attachment.name} {m.attachment.size ? `(${formatBytes(m.attachment.size)})` : ""}
                  </a>
                )}
                <p className={`mt-1 text-[10px] ${mine ? "text-brand-200" : "text-gray-400"}`}>{timeAgo(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="py-10 text-center text-xs text-gray-400">No messages yet — say hello.</p>}
      </div>

      <div className="border-t border-gray-100 p-3">
        {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
        {isBlocked && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">You blocked this user. Unblock to continue the conversation.</p>}
        <div className="flex items-end gap-2">
          <input ref={attachRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFile(f); e.target.value = ""; }} />
          <button onClick={() => attachRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-brand-300 hover:text-brand-800" title="Attach a file (PDF, image, text up to 10 MB)">
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isBlocked ? "Unblock to reply…" : "Write a message…  (Enter to send)"}
            disabled={isBlocked}
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:bg-gray-50"
          />
          <Button onClick={() => send()} loading={sending} disabled={isBlocked || !body.trim()} className="h-10 w-10 !p-0">
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
          <CheckCheck className="h-3 w-3" /> Replies by email are not supported yet — respond here in the secure inbox.
        </p>
      </div>
    </>
  );
}
