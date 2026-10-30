"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, X } from "lucide-react";
import { startConversationAction } from "@/lib/actions/messaging";
import { Alert, Button, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/actions/auth";

export function MessageComposer({ recipientId, recipientName, jobId, applicationId, label = "Message", variant = "outline", size = "sm" }: {
  recipientId: string;
  recipientName: string;
  jobId?: string;
  applicationId?: string;
  label?: string;
  variant?: "outline" | "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(startConversationAction, {});
  const router = useRouter();

  React.useEffect(() => {
    if (state.success) {
      router.push(`/inbox?c=${state.success}`);
    }
  }, [state.success, router]);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <MessageSquareText className="h-4 w-4" /> {label}
      </Button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-brand-950">Message {recipientName}</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            {state.error && <div className="mb-3"><Alert tone="error">{state.error}</Alert></div>}
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="recipientId" value={recipientId} />
              {jobId && <input type="hidden" name="jobId" value={jobId} />}
              {applicationId && <input type="hidden" name="applicationId" value={applicationId} />}
              <Textarea name="body" rows={4} maxLength={4000} placeholder="Introduce yourself and be specific about the role or the candidate's profile…" required />
              <Button type="submit" loading={pending} className="w-full">Send message</Button>
              <p className="text-center text-[11px] text-gray-400">Response times are tracked to keep the marketplace accountable.</p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
