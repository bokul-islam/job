"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, X } from "lucide-react";
import { applyToJobAction } from "@/lib/actions/applications";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";
import { FileUploader } from "@/components/file-uploader";
import type { Resume } from "@/db/schema";
import type { ActionState } from "@/lib/actions/auth";

export function ApplyDialog({ jobId, resumes, applied, disabledReason }: {
  jobId: string; resumes: Resume[]; applied: boolean; disabledReason?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = React.useActionState<ActionState, FormData>(applyToJobAction, {});
  const router = useRouter();
  const ready = resumes.filter((r) => r.status === "ready");

  React.useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => { setOpen(false); router.refresh(); }, 1200);
      return () => clearTimeout(t);
    }
  }, [state.success, router]);

  if (applied) {
    return <Button disabled variant="secondary" size="lg">Already applied</Button>;
  }

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)} disabled={!!disabledReason} title={disabledReason}>
        <Send className="h-4 w-4" /> Apply now
      </Button>
      {disabledReason && <p className="mt-2 text-xs text-gray-400">{disabledReason}</p>}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-950">Submit application</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            {state.error && <div className="mb-4"><Alert tone="error">{state.error}</Alert></div>}
            {state.success && <div className="mb-4"><Alert tone="success">{state.success}</Alert></div>}

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="jobId" value={jobId} />
              <Field label="Resume (PDF)" hint="Choose a saved resume or upload a new one below.">
                <Select name="resumeId" defaultValue={ready.find((r) => r.isPrimary)?.id ?? ""}>
                  <option value="">No resume attached (not recommended)</option>
                  {ready.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </Select>
              </Field>
              <Field label="Cover letter" hint="Optional — a short note increases response rates.">
                <Textarea name="coverLetter" rows={5} maxLength={6000} placeholder="Tell the employer why you're a great fit…" />
              </Field>
              <Button type="submit" loading={pending} className="w-full" size="lg">Submit application</Button>
            </form>

            <div className="mt-4 border-t border-dashed border-gray-200 pt-4">
              <p className="mb-2 text-xs font-semibold text-gray-500">Need to upload a resume first?</p>
              <FileUploader
                purpose="resume"
                accept="application/pdf"
                maxBytes={10 * 1024 * 1024}
                label="Upload PDF resume"
                extraMeta={() => ({})}
                onComplete={async ({ key, fileName, size, mimeType }) => {
                  const { confirmResumeUploadAction } = await import("@/lib/actions/uploads");
                  return confirmResumeUploadAction({ key, fileName, size, mimeType, title: fileName });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
