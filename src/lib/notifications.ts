import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences, notifications, users } from "@/db/schema";
import { notificationEmail, sendEmail } from "@/lib/email";
import { appBaseUrl } from "@/lib/utils";

type PrefChannel = "inAppMessages" | "inAppApplications" | "inAppJobAlerts" | "inAppMembership";
type EmailChannel = "emailMessages" | "emailApplications" | "emailJobAlerts" | "emailMembership";

export type NotificationKind = "message" | "application" | "job_alert" | "membership";

const IN_APP: Record<NotificationKind, PrefChannel> = {
  message: "inAppMessages",
  application: "inAppApplications",
  job_alert: "inAppJobAlerts",
  membership: "inAppMembership",
};

const EMAIL: Record<NotificationKind, EmailChannel> = {
  message: "emailMessages",
  application: "emailApplications",
  job_alert: "emailJobAlerts",
  membership: "emailMembership",
};

async function getPrefs(userId: string) {
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];
  const created = await db.insert(notificationPreferences).values({ userId }).returning();
  return created[0];
}

export async function notify(
  userId: string,
  kind: NotificationKind,
  type: string,
  title: string,
  body: string,
  url: string,
  opts: { email?: boolean } = {}
) {
  const prefRows = await getPrefs(userId);
  const allowInApp = prefRows?.[IN_APP[kind]] !== false;
  const allowEmail = prefRows?.[EMAIL[kind]] === true;

  if (allowInApp) {
    await db.insert(notifications).values({ userId, type, title, body, url });
  }

  if (opts.email && allowEmail) {
    const target = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const recipient = target[0];
    if (recipient) {
      await sendEmail(
        notificationEmail(recipient.email, recipient.name, title, body, `${appBaseUrl()}${url}`)
      );
    }
  }
}
