import { NextResponse } from "next/server";
import { processPaymentWebhook } from "@/lib/actions/membership";
import { emailRelayWebhookNotice } from "@/lib/relay";

/**
 * Payment provider webhooks. Signature verification happens before any
 * subscription change. Events are recorded (idempotent) in
 * payment_webhook_events.
 */
export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!["sandbox", "sslcommerz", "bkash"].includes(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const raw = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? request.headers.get("x-signature");
  const result = await processPaymentWebhook(provider as "sandbox" | "sslcommerz" | "bkash", raw, signature);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ status: "ok", note: emailRelayWebhookNotice() });
}
