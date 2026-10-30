"use client";

import * as React from "react";
import { CheckCircle2, FlaskConical, ShieldAlert, X } from "lucide-react";
import { startSandboxCheckout, simulateSandboxWebhook } from "@/lib/actions/membership";
import { Alert, Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { MembershipPlan } from "@/db/schema";

export function PricingTable({
  plans, currentPlanId, role,
}: {
  plans: MembershipPlan[];
  currentPlanId?: string | null;
  role: "job_seeker" | "employer";
}) {
  const [interval, setInterval] = React.useState<"monthly" | "yearly">("monthly");
  const active = plans.filter((p) => p.audience === role && p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-3">
        <button onClick={() => setInterval("monthly")} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition", interval === "monthly" ? "bg-brand-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200")}>Monthly</button>
        <button onClick={() => setInterval("yearly")} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition", interval === "yearly" ? "bg-brand-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200")}>
          Yearly <span className="ml-1 text-xs opacity-75">(save ~17%)</span>
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {active.map((plan, i) => {
          const price = interval === "monthly" ? plan.priceMonthly : plan.priceYearly;
          const isCurrent = currentPlanId === plan.id;
          return (
            <Card key={plan.id} className={cn("relative flex flex-col p-6", i === 1 && "border-brand-500 ring-2 ring-brand-500/30")}>
              {i === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-500 px-3 py-0.5 text-[11px] font-bold text-white">MOST POPULAR</span>}
              <p className="text-sm font-bold uppercase tracking-wider text-gray-500">{plan.name}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-brand-950">{price === 0 ? "Free" : `৳${price.toLocaleString()}`}</span>
                {price > 0 && <span className="text-sm text-gray-500">/{interval === "monthly" ? "mo" : "yr"}</span>}
              </div>
              {plan.description && <p className="mt-2 text-xs leading-relaxed text-gray-500">{plan.description}</p>}
              <ul className="mt-5 flex-1 space-y-2.5">
                {(plan.features ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>Current plan</Button>
                ) : price === 0 ? (
                  <Button variant="outline" className="w-full" disabled={!!currentPlanId && !isCurrent}>{currentPlanId ? "Downgrade after current term" : "Included by default"}</Button>
                ) : (
                  <SandboxCheckoutButton plan={plan} interval={interval} variant={i === 1 ? "primary" : "outline"} />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mx-auto mt-8 max-w-2xl">
        <Alert tone="info">
          <div className="flex items-start gap-2 text-xs leading-relaxed">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Payments run in sandbox mode.</strong> SSLCommerz and bKash providers are wired behind the same
              verification pipeline and activate when merchant credentials (<code>SSLCZ_*</code>, <code>BKASH_*</code>) are
              configured. Subscriptions only activate after a server-side signed webhook confirms the payment — clicking a
              button alone never upgrades an account.
            </p>
          </div>
        </Alert>
      </div>
    </div>
  );
}

function SandboxCheckoutButton({ plan, interval, variant }: { plan: MembershipPlan; interval: "monthly" | "yearly"; variant: "primary" | "outline" }) {
  const [open, setOpen] = React.useState(false);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "webhook" | "done" | "failed">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const amount = interval === "monthly" ? plan.priceMonthly : plan.priceYearly;

  async function begin() {
    setState("loading");
    setError(null);
    const result = await startSandboxCheckout(plan.id, interval);
    if (result.error) { setError(result.error); setState("idle"); return; }
    setPaymentId(result.paymentId!);
    setState("webhook");
  }

  async function finalize(outcome: "success" | "failed") {
    if (!paymentId) return;
    setState("loading");
    const result = await simulateSandboxWebhook(paymentId, outcome);
    if (result.error) { setError(result.error); setState("webhook"); return; }
    setState(outcome === "success" ? "done" : "failed");
  }

  return (
    <>
      <Button variant={variant} className="w-full" onClick={() => setOpen(true)}>
        {plan.name === "Premium" ? "Go Premium" : `Choose ${plan.name}`}
      </Button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-brand-950">
                <FlaskConical className="h-5 w-5 text-accent-600" /> Sandbox checkout
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              Development mode — no real money is charged. This exercises the same signed webhook verification used by
              production providers.
            </div>

            <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700">{plan.name} · {interval}</span>
                <span className="text-xl font-extrabold text-brand-950">৳{amount.toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Billed {interval}. Cancel anytime — keeps access until period end.</p>
            </div>

            {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

            {state === "idle" && (
              <Button className="mt-5 w-full" size="lg" onClick={begin}>Continue to sandbox payment</Button>
            )}
            {state === "loading" && (
              <Button className="mt-5 w-full" size="lg" loading>Processing…</Button>
            )}
            {state === "webhook" && (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-gray-600">
                  Payment <span className="font-mono text-xs">initiated</span>. In production, the provider redirects here
                  and its servers send a signed webhook. Simulate the provider callbacks:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="accent" onClick={() => finalize("success")}>Simulate success webhook</Button>
                  <Button variant="danger" onClick={() => finalize("failed")}>Simulate failure webhook</Button>
                </div>
              </div>
            )}
            {state === "done" && (
              <div className="mt-5 space-y-3 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <p className="text-sm font-semibold text-gray-800">Webhook verified — your {plan.name} membership is now active.</p>
                <Button className="w-full" onClick={() => window.location.assign("/dashboard/billing")}>View billing</Button>
              </div>
            )}
            {state === "failed" && (
              <div className="mt-5 space-y-3">
                <Alert tone="error">
                  <span className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4" /> The sandbox provider reported a failed payment. No charge was made and no membership was activated.
                  </span>
                </Alert>
                <Button className="w-full" variant="outline" onClick={() => setOpen(false)}>Close</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
