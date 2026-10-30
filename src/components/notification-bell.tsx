"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/utils";

type Item = { id: string; title: string; body: string | null; url: string | null; isRead: boolean; createdAt: string };

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [unread, setUnread] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch { /* offline */ }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function markAll() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    load();
  }

  async function remove(id: string) {
    await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition hover:bg-brand-50 hover:text-brand-900"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[380px] max-w-[90vw] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-bold text-brand-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-10 text-center text-sm text-gray-400">You&apos;re all caught up.</p>}
            {items.map((item) => (
              <div key={item.id} className={`group flex gap-3 border-b border-gray-50 px-4 py-3 transition hover:bg-brand-50/50 ${!item.isRead ? "bg-blue-50/40" : ""}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.isRead ? "bg-gray-200" : "bg-accent-500 animate-pulse-dot"}`} />
                <div className="min-w-0 flex-1">
                  <Link href={item.url ?? "/notifications"} onClick={() => setOpen(false)} className="block">
                    <p className="truncate text-[13px] font-semibold text-gray-900">{item.title}</p>
                    {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.body}</p>}
                    <p className="mt-1 text-[11px] text-gray-400">{timeAgo(item.createdAt)}</p>
                  </Link>
                </div>
                <button onClick={() => remove(item.id)} className="hidden shrink-0 text-gray-300 hover:text-red-500 group-hover:block" aria-label="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-gray-100 py-2.5 text-center text-xs font-semibold text-brand-700 hover:bg-brand-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
