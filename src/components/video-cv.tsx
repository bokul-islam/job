"use client";

import * as React from "react";
import { Eye, EyeOff, Film, Globe2, Pencil, Trash2, Users } from "lucide-react";
import { deleteVideoCvAction, updateVideoCvAction, confirmVideoCvUploadAction } from "@/lib/actions/uploads";
import { Button, Card, EmptyState, Field, Input, Textarea, Select, Badge } from "@/components/ui";
import { FileUploader } from "@/components/file-uploader";
import { formatBytes, formatDuration, timeAgo } from "@/lib/utils";
import type { VideoCv } from "@/db/schema";

export function VideoCvManager({ videos, allowed, planName, maxMb, maxSeconds }: {
  videos: VideoCv[];
  allowed: boolean;
  planName: string;
  maxMb: number;
  maxSeconds: number;
}) {
  const [editing, setEditing] = React.useState<string | null>(null);
  const [pendingVideo, setPendingVideo] = React.useState<{ key: string; fileName: string; size: number; mimeType: string; durationSeconds?: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-5">
      {!allowed && (
        <Card className="border-amber-200 bg-amber-50/60 p-5">
          <p className="text-sm font-semibold text-amber-900">Video CV requires the Standard plan or above.</p>
          <p className="mt-1 text-xs text-amber-700">
            Your current plan is <strong>{planName}</strong>. Upgrade to publish a 2‑minute video CV and stand out to employers.
          </p>
          <Button size="sm" className="mt-3" onClick={() => window.location.assign("/pricing")}>View plans</Button>
        </Card>
      )}

      {allowed && !pendingVideo && (
        <Card className="p-5">
          <p className="mb-1 text-sm font-bold text-brand-900">Upload a new video CV</p>
          <p className="mb-3 text-xs text-gray-500">MP4 or WebM · max {maxMb} MB · max {formatDuration(maxSeconds)} · validated on the server (magic bytes, size, type).</p>
          <FileUploader
            purpose="video_cv"
            accept="video/mp4,video/webm"
            maxBytes={maxMb * 1024 * 1024}
            label="Choose video file"
            extraMeta={async ( ) => ({})}
            onComplete={async ({ key, fileName, size, mimeType }) => {
              // Probe duration from the freshly selected file via an object URL in the parent flow is complex post-upload;
              // duration is validated again below in the metadata form.
              setPendingVideo({ key, fileName, size, mimeType });
              return undefined;
            }}
          />
          {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        </Card>
      )}

      {pendingVideo && (
        <VideoMetaForm
          maxSeconds={maxSeconds}
          onCancel={() => setPendingVideo(null)}
          onSubmit={async (title, description, durationSeconds) => {
            const result = await confirmVideoCvUploadAction({ ...pendingVideo, title, description, durationSeconds });
            if (result.error) { setError(result.error); return; }
            setPendingVideo(null);
            window.location.reload();
          }}
        />
      )}

      {videos.length === 0 && !pendingVideo ? (
        <EmptyState
          icon={<Film className="h-6 w-6" />}
          title="No video CV yet"
          body="A short video introduction helps employers understand your communication style. Private by default — only authorized employers can view."
        />
      ) : (
        <div className="space-y-4">
          {videos.map((video) => (
            <Card key={video.id} className="p-5">
              <div className="flex flex-col gap-4 md:flex-row">
                <video src={`/api/files/${video.fileKey}`} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black md:w-64" />
                <div className="min-w-0 flex-1">
                  {editing === video.id ? (
                    <EditVideoForm video={video} onDone={() => setEditing(null)} />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-brand-950">{video.title}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {video.fileName} · {formatBytes(video.fileSize)} · {video.durationSeconds ? formatDuration(video.durationSeconds) : "duration n/a"} · uploaded {timeAgo(video.createdAt)}
                          </p>
                        </div>
                        <VisibilityBadge visibility={video.visibility} />
                      </div>
                      {video.description && <p className="mt-2 text-sm text-gray-600">{video.description}</p>}
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(video.id)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={async () => { if (confirm("Delete this video CV?")) { await deleteVideoCvAction(video.id); } }}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  if (visibility === "public") return <Badge tone="teal"><Globe2 className="h-3 w-3" /> Public</Badge>;
  if (visibility === "employers") return <Badge tone="navy"><Users className="h-3 w-3" /> Verified employers</Badge>;
  return <Badge tone="gray"><EyeOff className="h-3 w-3" /> Private</Badge>;
}

function VideoMetaForm({ maxSeconds, onCancel, onSubmit }: {
  maxSeconds: number;
  onCancel: () => void;
  onSubmit: (title: string, description: string, durationSeconds?: number) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [duration, setDuration] = React.useState<string>("");
  return (
    <Card className="p-5 ring-2 ring-accent-200">
      <p className="mb-3 text-sm font-bold text-brand-900">Almost done — describe your video</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Full-Stack Engineer — 2 min intro" />
        </Field>
        <Field label="Duration (seconds)" hint={`Validated server-side — max ${maxSeconds}s`}>
          <Input type="number" min={1} max={maxSeconds} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="90" />
        </Field>
      </div>
      <Field label="Description" className="mt-4">
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One or two sentences about this introduction." />
      </Field>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => onSubmit(title, description, duration ? Number(duration) : undefined)} disabled={!title.trim()}>Publish video CV</Button>
        <Button variant="outline" onClick={onCancel}>Discard</Button>
      </div>
    </Card>
  );
}

function EditVideoForm({ video, onDone }: { video: VideoCv; onDone: () => void }) {
  const [title, setTitle] = React.useState(video.title);
  const [description, setDescription] = React.useState(video.description ?? "");
  const [visibility, setVisibility] = React.useState(video.visibility);
  const [saving, setSaving] = React.useState(false);
  return (
    <div className="space-y-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      <Select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
        <option value="private">Private — only me</option>
        <option value="employers">Verified employers</option>
        <option value="public">Public</option>
      </Select>
      <div className="flex gap-2">
        <Button size="sm" loading={saving} onClick={async () => { setSaving(true); await updateVideoCvAction(video.id, { title, description, visibility }); setSaving(false); onDone(); }}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
      <p className="flex items-center gap-1 text-[11px] text-gray-400"><Eye className="h-3 w-3" /> Videos are always served through permission-checked links.</p>
    </div>
  );
}
