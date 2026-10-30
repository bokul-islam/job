import "server-only";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { appBaseUrl } from "@/lib/utils";

/**
 * Provider-independent email interface.
 *
 * Order of resolution:
 *  1. RESEND_API_KEY set -> send via Resend free-tier API (3k emails/mo).
 *  2. Otherwise -> development mode: the message is persisted in the
 *     email_logs table and visible in the admin "Mail outbox" (and printed
 *     to the server console). Nothing is silently dropped.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  template: string;
  html: string;
  meta?: Record<string, unknown>;
};

export async function sendEmail(message: EmailMessage): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "TalentBridge <noreply@talentbridge.dev>";

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: message.to, subject: message.subject, html: message.html }),
      });
      const ok = res.ok;
      await db.insert(emailLogs).values({
        toEmail: message.to,
        subject: message.subject,
        template: message.template,
        body: message.html,
        status: ok ? "sent" : "failed",
        meta: JSON.stringify({ provider: "resend", status: res.status, ...message.meta }),
      });
      return { delivered: ok };
    } catch (err) {
      await db.insert(emailLogs).values({
        toEmail: message.to,
        subject: message.subject,
        template: message.template,
        body: message.html,
        status: "failed",
        meta: JSON.stringify({ provider: "resend", error: String(err) }),
      });
      return { delivered: false };
    }
  }

  // Development mode: log to DB + console (links remain clickable from the outbox).
  const link = extractFirstLink(message.html);
  await db.insert(emailLogs).values({
    toEmail: message.to,
    subject: message.subject,
    template: message.template,
    body: message.html,
    status: "logged",
    meta: JSON.stringify({ mode: "development", link, ...message.meta }),
  });
  console.log(`[email:dev] To: ${message.to} | ${message.subject}${link ? ` | Link: ${link}` : ""}`);
  return { delivered: false };
}

function extractFirstLink(html: string): string | null {
  const match = html.match(/href="([^"]+)"/);
  return match?.[1] ?? null;
}

/* --------------------------------- Templates --------------------------------- */

function layout(title: string, body: string) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#f4f6fa;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e8f0">
      <div style="background:#0b2447;padding:20px 28px;color:#fff;font-weight:700;font-size:18px">TalentBridge</div>
      <div style="padding:28px">
        <h1 style="font-size:18px;margin:0 0 12px;color:#0b2447">${title}</h1>
        <div style="font-size:14px;line-height:1.6;color:#3d4757">${body}</div>
      </div>
      <div style="padding:16px 28px;font-size:12px;color:#8a94a6;border-top:1px solid #eef1f6">
        You received this email because you have a TalentBridge account.
      </div>
    </div>
  </div>`;
}

function cta(url: string, label: string) {
  return `<a href="${url}" style="display:inline-block;background:#0b2447;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:600;margin-top:16px">${label}</a>`;
}

export function verificationEmail(to: string, name: string, token: string): EmailMessage {
  const url = `${appBaseUrl()}/auth/verify?token=${token}`;
  return {
    to,
    subject: "Verify your TalentBridge email address",
    template: "email_verify",
    html: layout(
      "Confirm your email",
      `<p>Hi ${escapeHtml(name)}, welcome to TalentBridge. Confirm this email address to unlock applications, messaging and job posting.</p>${cta(url, "Verify email address")}<p style="margin-top:16px;font-size:12px;color:#8a94a6">This link expires in 24 hours. If you did not sign up, ignore this email.</p>`
    ),
    meta: { link: url },
  };
}

export function passwordResetEmail(to: string, name: string, token: string): EmailMessage {
  const url = `${appBaseUrl()}/auth/reset?token=${token}`;
  return {
    to,
    subject: "Reset your TalentBridge password",
    template: "password_reset",
    html: layout(
      "Reset your password",
      `<p>Hi ${escapeHtml(name)}, we received a request to reset your password.</p>${cta(url, "Choose a new password")}<p style="margin-top:16px;font-size:12px;color:#8a94a6">This link expires in 60 minutes. If this was not you, your account is safe — ignore this email.</p>`
    ),
    meta: { link: url },
  };
}

export function notificationEmail(to: string, name: string, title: string, body: string, url: string): EmailMessage {
  return {
    to,
    subject: title,
    template: "notification",
    html: layout(title, `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(body)}</p>${cta(url, "Open in TalentBridge")}`),
    meta: { link: url },
  };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
