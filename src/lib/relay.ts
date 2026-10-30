/**
 * Inbound email relay: future extension point.
 *
 * Today the platform sends outbound notification emails with a secure link back
 * to the inbox. True two-way email relay requires an inbound provider (e.g.
 * SendGrid Inbound Parse, Mailgun Routes, Postmark Inbound). This module defines
 * the contract:
 *
 *  POST /api/email/inbound
 *    headers: x-email-signature (HMAC over raw body with INBOUND_EMAIL_SECRET)
 *    body: { to, from, subject, text, headers }
 *
 *  Processing rules:
 *   1. Verify the webhook signature (reject without a valid one).
 *   2. Extract the conversation identifier from the reply-to address/token
 *      (`reply+<conversationId>.<token>@in.talentbridge.dev`). The token is an
 *      HMAC of conversationId+userId so addresses cannot be forged.
 *   3. Only registered participants may inject a message; reject otherwise.
 *   4. Log every attempt in email_relay_logs, including rejections.
 *
 * Until an inbound provider is configured (INBOUND_EMAIL_DOMAIN +
 * INBOUND_EMAIL_SECRET), the UI tells users that replies must be sent from the
 * platform inbox. This is intentionally not faked.
 */
export function inboundEmailConfigured(): boolean {
  return Boolean(process.env.INBOUND_EMAIL_DOMAIN && process.env.INBOUND_EMAIL_SECRET);
}

export function emailRelayWebhookNotice(): string {
  return inboundEmailConfigured()
    ? "Inbound email relay configured."
    : "Inbound email relay is not configured. Replies must be sent from the platform inbox.";
}
