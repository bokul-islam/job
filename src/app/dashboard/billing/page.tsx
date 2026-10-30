import { desc, eq } from "drizzle-orm";
import { CreditCard, ReceiptText } from "lucide-react";
import { db } from "@/db";
import { payments, subscriptions, membershipPlans } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/entitlements";
import { cancelSubscriptionAction, resumeSubscriptionAction } from "@/lib/actions/membership";
import { providerConfigured } from "@/lib/payments";
import { DashboardShell } from "@/components/dashboard-shell";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, STATUS_TONES } from "@/components/ui";
import { formatMoney, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing & membership" };

export default async function BillingPage() {
  const user = await requireUser();
  const active = await getActiveSubscription(user.id);

  const [history, paymentRows] = await Promise.all([
    db
      .select({ sub: subscriptions, plan: membershipPlans })
      .from(subscriptions)
      .innerJoin(membershipPlans, eq(membershipPlans.id, subscriptions.planId))
      .where(eq(subscriptions.userId, user.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(10),
    db.select().from(payments).where(eq(payments.userId, user.id)).orderBy(desc(payments.createdAt)).limit(15),
  ]);

  const sslcz = providerConfigured("sslcommerz");
  const bkash = providerConfigured("bkash");

  return (
    <DashboardShell active="/dashboard/billing">
      <PageHeader title="Billing & membership" subtitle="Subscription changes only happen through verified payment webhooks." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Current membership" action={active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Free</Badge>} />
          <div className="space-y-3 p-5 text-sm">
            {active ? (
              <>
                <div className="flex items-center justify-between"><span className="text-gray-500">Plan</span><span className="font-bold text-brand-900">{active.plan.name}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Billing interval</span><span className="font-semibold capitalize text-gray-800">{active.sub.interval}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Started</span><span className="font-semibold text-gray-800">{active.sub.startedAt.toDateString()}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">{active.sub.cancelAtPeriodEnd ? "Expires" : "Renews"}</span><span className="font-semibold text-gray-800">{active.sub.currentPeriodEnd?.toDateString()}</span></div>
                {active.sub.cancelAtPeriodEnd && <Alert tone="warning">Your subscription will not renew. Access continues until the period ends.</Alert>}
                <div className="flex gap-2 pt-2">
                  {active.sub.cancelAtPeriodEnd ? (
                    <form action={async () => { "use server"; await resumeSubscriptionAction(); }}><Button size="sm" variant="accent">Resume renewals</Button></form>
                  ) : (
                    <form action={async () => { "use server"; await cancelSubscriptionAction(); }}><Button size="sm" variant="outline">Cancel renewal</Button></form>
                  )}
                  <LinkButton href="/pricing" size="sm" variant="ghost">Change plan</LinkButton>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600">You&apos;re on the free tier. Upgrade to unlock higher limits and video CVs.</p>
                <LinkButton href="/pricing" size="sm">View plans</LinkButton>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment providers" subtitle="Production providers need merchant credentials" />
          <div className="space-y-3 p-5 text-sm">
            <ProviderRow name="Sandbox (development)" configured={providerConfigured("sandbox").configured} note="Simulated signed webhooks — no real charge" />
            <ProviderRow name="SSLCommerz" configured={sslcz.configured} note={sslcz.note} />
            <ProviderRow name="bKash" configured={bkash.configured} note={bkash.note} />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Subscription history" />
          <div className="divide-y divide-gray-50">
            {history.length === 0 && <p className="p-5 text-sm text-gray-400">No subscriptions yet.</p>}
            {history.map(({ sub, plan }) => (
              <div key={sub.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">{plan.name} <span className="text-xs font-normal text-gray-400">({sub.interval})</span></p>
                  <p className="text-xs text-gray-400">started {sub.startedAt.toDateString()}{sub.currentPeriodEnd ? ` · ends ${sub.currentPeriodEnd.toDateString()}` : ""}</p>
                </div>
                <Badge tone={STATUS_TONES[sub.status] ?? "gray"}>{sub.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment history" />
          <div className="divide-y divide-gray-50">
            {paymentRows.length === 0 && (
              <div className="p-5"><EmptyState icon={<ReceiptText className="h-5 w-5" />} title="No payments" body="Sandbox checkouts and provider payments will be recorded here." /></div>
            )}
            {paymentRows.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-gray-300" />
                  <div>
                    <p className="font-semibold text-gray-900">{formatMoney(p.amount, p.currency)}</p>
                    <p className="text-xs text-gray-400">{p.provider}{p.providerRef === "DEV-GRANT" ? " · dev grant" : ""} · {timeAgo(p.createdAt)}</p>
                  </div>
                </div>
                <Badge tone={STATUS_TONES[p.status] ?? "gray"}>{p.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

function ProviderRow({ name, configured, note }: { name: string; configured: boolean; note: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
      <div>
        <p className="font-semibold text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">{note}</p>
      </div>
      <Badge tone={configured ? "green" : "gray"}>{configured ? "Ready" : "Needs credentials"}</Badge>
    </div>
  );
}
