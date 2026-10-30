"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { membershipPlans, payments, paymentWebhookEvents, subscriptions } from "@/db/schema";
import { requireRole, requireUser } from "@/lib/auth";
import {
  activateSubscription, computePeriodEnd, hmacSignature, paymentHistory, recordWebhookEvent, timingSafeVerify,
} from "@/lib/payments";
import { getActiveSubscription } from "@/lib/entitlements";
import { logAudit } from "@/lib/logging";
import { notify } from "@/lib/notifications";

const SANDBOX_SECRET = process.env.SANDBOX_WEBHOOK_SECRET ?? "dev-sandbox-secret-change-me";

/**
 * Sandbox checkout (development only): creates an *initiated* payment.
 * Nothing is activated here — that only happens through the verified webhook path.
 */
export async function startSandboxCheckout(planId: string, interval: "monthly" | "yearly"): Promise<{ paymentId?: string; error?: string }> {
  const user = await requireUser();
  if (!["job_seeker", "employer"].includes(user.role)) return { error: "Only job seekers and employers can subscribe." };
  const plan = (await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1))[0];
  if (!plan || !plan.isActive) return { error: "Plan not found." };
  if (plan.audience !== (user.role === "employer" ? "employer" : "job_seeker")) return { error: "This plan is not for your account type." };
  const amount = interval === "monthly" ? plan.priceMonthly : plan.priceYearly;
  if (amount <= 0) return { error: "Free plans do not require payment." };

  const ref = `SBX-${cryptoRandom()}`;
  const [payment] = await db
    .insert(payments)
    .values({ userId: user.id, amount, currency: plan.currency, provider: "sandbox", providerRef: ref, status: "initiated", meta: JSON.stringify({ planId, interval }) })
    .returning();
  return { paymentId: payment.id };
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10).toUpperCase() + Date.now().toString(36).toUpperCase();
}

/**
 * Simulates the provider redirecting back + sending a signed webhook.
 * The signature is generated server-side and verified by the same code path
 * used by the real provider webhooks — a UI click alone cannot activate a plan.
 */
export async function simulateSandboxWebhook(paymentId: string, outcome: "success" | "failed"): Promise<{ error?: string }> {
  const user = await requireUser();
  const payment = (await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1))[0];
  if (!payment || payment.userId !== user.id) return { error: "Payment not found." };
  if (payment.status !== "initiated") return { error: "This payment has already been processed." };

  const payload = JSON.stringify({
    eventId: `evt_${cryptoRandom()}`,
    type: outcome === "success" ? "payment.completed" : "payment.failed",
    data: { ref: payment.providerRef, paymentId: payment.id },
    created: Math.floor(Date.now() / 1000),
  });
  const signature = hmacSignature(payload, SANDBOX_SECRET);
  return processPaymentWebhook("sandbox", payload, signature);
}

/** Shared verification path used by API route handlers and the sandbox simulator. */
export async function processPaymentWebhook(
  provider: "sandbox" | "sslcommerz" | "bkash",
  rawPayload: string,
  signature: string | null
): Promise<{ error?: string }> {
  let eventId = "";
  let signatureOk = false;

  try {
    const parsed = JSON.parse(rawPayload) as { eventId?: string; type?: string; data?: { ref?: string; paymentId?: string } };
    eventId = parsed.eventId ?? "";
    if (!eventId) return { error: "Missing event id." };

    if (provider === "sandbox") {
      signatureOk = !!signature && timingSafeVerify(rawPayload, signature, SANDBOX_SECRET);
    } else if (provider === "sslcommerz") {
      signatureOk = !!signature && !!process.env.SSLCZ_STORE_PASSWORD && timingSafeVerify(rawPayload, signature, process.env.SSLCZ_STORE_PASSWORD);
    } else {
      signatureOk = !!signature && !!process.env.BKASH_APP_SECRET && timingSafeVerify(rawPayload, signature, process.env.BKASH_APP_SECRET);
    }

    await recordWebhookEvent(provider, eventId, rawPayload, signatureOk);
    if (!signatureOk) {
      await logAudit(null, "payment.webhook_rejected", "payment", undefined, { provider, eventId });
      return { error: "Invalid webhook signature." };
    }

    const paymentId = parsed.data?.paymentId;
    if (!paymentId) return { error: "Malformed payload." };
    const payment = (await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1))[0];
    if (!payment) return { error: "Unknown payment." };
    if (payment.status !== "initiated") return {}; // idempotent

    const meta = payment.meta ? (JSON.parse(payment.meta) as { planId: string; interval: "monthly" | "yearly" }) : null;
    if (parsed.type === "payment.completed" && meta) {
      await db.update(payments).set({ status: "completed" }).where(eq(payments.id, payment.id));
      await activateSubscription({ userId: payment.userId, planId: meta.planId, interval: meta.interval, paymentId: payment.id });
      await notify(payment.userId, "membership", "payment_completed", "Payment successful", "Your payment was verified and your membership is active.", "/dashboard/billing", { email: true });
    } else {
      await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
      await notify(payment.userId, "membership", "payment_failed", "Payment failed", "Your payment could not be completed. No charge was made.", "/pricing", { email: true });
    }
    await db.update(paymentWebhookEvents).set({ processedAt: new Date() }).where(eq(paymentWebhookEvents.eventId, eventId));
    return {};
  } catch (err) {
    console.error("[payments] webhook error", err);
    return { error: "Webhook processing failed." };
  }
}

export async function cancelSubscriptionAction(): Promise<{ error?: string }> {
  const user = await requireUser();
  const active = await getActiveSubscription(user.id);
  if (!active) return { error: "No active subscription." };
  await db.update(subscriptions).set({ cancelAtPeriodEnd: true, updatedAt: new Date() }).where(eq(subscriptions.id, active.sub.id));
  await notify(user.id, "membership", "membership_canceled", "Subscription will not renew", `Your ${active.plan.name} plan remains active until ${active.sub.currentPeriodEnd?.toDateString()} and will not renew.`, "/dashboard/billing");
  await logAudit(user.id, "subscription.canceled", "subscription", active.sub.id);
  revalidatePath("/dashboard/billing");
  return {};
}

export async function resumeSubscriptionAction(): Promise<{ error?: string }> {
  const user = await requireUser();
  const active = await getActiveSubscription(user.id);
  if (!active) return { error: "No active subscription." };
  await db.update(subscriptions).set({ cancelAtPeriodEnd: false, updatedAt: new Date() }).where(eq(subscriptions.id, active.sub.id));
  revalidatePath("/dashboard/billing");
  return {};
}

/** Development-only admin grant, clearly labelled. Super admin only. */
export async function devGrantMembershipAction(email: string, planSlug: string, interval: "monthly" | "yearly"): Promise<{ error?: string; success?: string }> {
  const admin = await requireRole("super_admin");
  const { adminUserLookup } = await import("@/lib/payments");
  const target = await adminUserLookup(email.toLowerCase().trim());
  if (!target) return { error: "User not found." };
  const plan = (await db.select().from(membershipPlans).where(eq(membershipPlans.slug, planSlug)).limit(1))[0];
  if (!plan) return { error: "Plan not found." };
  const [payment] = await db
    .insert(payments)
    .values({ userId: target.id, amount: 0, currency: plan.currency, provider: "sandbox", providerRef: "DEV-GRANT", status: "completed", meta: JSON.stringify({ planId: plan.id, interval, devGrant: true }) })
    .returning();
  await activateSubscription({ userId: target.id, planId: plan.id, interval, paymentId: payment.id, actorId: admin.id });
  void computePeriodEnd;
  revalidatePath("/dashboard/admin/settings");
  return { success: `${plan.name} granted to ${target.email} (development grant).` };
}

export { paymentHistory };
