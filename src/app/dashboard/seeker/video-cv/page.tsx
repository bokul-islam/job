import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videoCvs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolvePlan } from "@/lib/entitlements";
import { seekerProfileFor } from "@/lib/queries";
import { maxUploadBytes, maxVideoDurationSeconds } from "@/lib/storage";
import { DashboardShell } from "@/components/dashboard-shell";
import { VideoCvManager } from "@/components/video-cv";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Video CV" };

export default async function VideoCvPage() {
  const user = await requireRole("job_seeker");
  const profile = await seekerProfileFor(user.id);
  const videos = profile ? await db.select().from(videoCvs).where(eq(videoCvs.seekerId, profile.id)) : [];
  const { plan, limits } = await resolvePlan(user);
  const maxMb = (await maxUploadBytes("video_cv")) / 1024 / 1024;
  const maxSeconds = await maxVideoDurationSeconds();

  return (
    <DashboardShell active="/dashboard/seeker/video-cv">
      <PageHeader
        title="Video CV studio"
        subtitle="Videos are stored privately and only streamed after a server-side permission check. Direct presigned uploads go to Cloudflare R2 when configured."
      />
      <VideoCvManager videos={videos} allowed={limits.videoCvAllowed} planName={plan?.name ?? "Free"} maxMb={Math.round(maxMb)} maxSeconds={maxSeconds} />
    </DashboardShell>
  );
}
