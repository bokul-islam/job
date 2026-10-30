import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { membershipPlans } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/entitlements";
import { SiteHeader, SiteFooter } from "@/components/chrome";
import { PricingTable } from "@/components/pricing";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Membership plans" };

export default async function PricingPage() {
  const user = await getSessionUser();
  const plans = await db.select().from(membershipPlans).where(eq(membershipPlans.isActive, true)).orderBy(asc(membershipPlans.sortOrder));
  const activeSub = user ? await getActiveSubscription(user.id) : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold text-brand-950 sm:text-4xl">Membership plans</h1>
          <p className="mt-3 text-sm text-gray-500 sm:text-base">
            Limits are stored in the database and enforced on the server — no client-side tricks. Sandbox payments
            exercise the real verification pipeline.
          </p>
        </div>

        <h2 className="mb-6 text-center text-lg font-extrabold uppercase tracking-widest text-brand-400">For job seekers</h2>
        <PricingTable
          plans={plans}
          role="job_seeker"
          currentPlanId={user?.role === "job_seeker" ? activeSub?.plan.id : undefined}
        />

        <div className="my-16 border-t border-dashed border-gray-200" />

        <h2 className="mb-6 text-center text-lg font-extrabold uppercase tracking-widest text-brand-400">For employers</h2>
        <PricingTable
          plans={plans}
          role="employer"
          currentPlanId={user?.role === "employer" ? activeSub?.plan.id : undefined}
        />

        {!user && (
          <div className="mt-10">
            <Alert tone="info">Sign in to purchase a plan — checkout is tied to your account and verified by signed webhooks.</Alert>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
