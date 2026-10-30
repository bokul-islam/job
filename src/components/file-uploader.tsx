"use client";

import * as React from "react";
import { CloudUpload, FileCheck2, XCircle } from "lucide-react";
import { Button, Progress } from "@/components/ui";
import { formatBytes } from "@/lib/utils";

type PresignResponse = { mode: "r2" | "local"; url: string; key: string } | { error: string };

/**
 * Real direct-upload flow with genuine progress events:
 *  1. POST /api/uploads/presign  -> validated short-lived upload URL (R2 presigned PUT or signed local token)
 *  2. XHR PUT straight to the storage URL with upload progress events
 *  3. onComplete(key, meta) -> server action verifies the file and creates the record
 */
export function FileUploader({
  purpose,
  accept,
  maxBytes,
  extraMeta,
  onComplete,
  label,
}: {
  purpose: "resume" | "video_cv" | "attachment" | "avatar" | "logo";
  accept: string;
  maxBytes: number;
  extraMeta?: () => Promise<Record<string, string | number>> | Record<string, string | number>;
  onComplete: (result: { key: string; fileName: string; size: number; mimeType: string; meta: Record<string, string | number> }) => Promise<{ error?: string } | undefined>;
  label: string;
}) {
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > maxBytes) {
      setError(`File too large — limit is ${formatBytes(maxBytes)}.`);
      return;
    }
    setFileName(file.name);
    setProgress(0);

    try {
      const presign = (await (
        await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose, fileName: file.name, contentType: file.type, size: file.size }),
        })
      ).json()) as PresignResponse;

      if ("error" in presign) {
        setError(presign.error);
        setProgress(null);
        return;
      }

      await xhrUpload(presign.url, file, (pct) => setProgress(pct));

      const meta = (await extraMeta?.()) ?? {};
      const result = await onComplete({ key: presign.key, fileName: file.name, size: file.size, mimeType: file.type, meta });
      if (result?.error) {
        setError(result.error);
      } else {
        setProgress(100);
        setTimeout(() => { setProgress(null); setFileName(null); }, 1200);
      }
    } catch {
      setError("Upload failed. Please try again.");
      setProgress(null);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {progress === null && (
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            <CloudUpload className="h-4 w-4" /> {label}
          </Button>
        </div>
      )}
      {progress !== null && (
        <div className="space-y-2 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-brand-900">
            <span className="inline-flex items-center gap-1.5 truncate">
              {progress < 100 ? <CloudUpload className="h-4 w-4 animate-pulse" /> : <FileCheck2 className="h-4 w-4 text-emerald-600" />}
              {fileName}
            </span>
            <span>{progress < 100 ? `${progress}%` : "done"}</span>
          </div>
          <Progress value={progress} />
        </div>
      )}
      {error && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600">
          <XCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

function xhrUpload(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}
