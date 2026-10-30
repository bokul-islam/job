import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { membershipPlans, planEntitlements } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { PlanEditor } from "@/components/admin-components";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Membership plans" };

export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireRole("admin", "super_admin");
  const sp = await searchParams;
  const editing = sp.edit ?? null;

  const plans = await db.select().from(membershipPlans).orderBy(asc(membershipPlans.audience), asc(membershipPlans.sortOrder));
  const ents = await db.select().from(planEntitlements);
  const editPlan = plans.find((p) => p.id === editing);
  const isSuper = admin.role === "super_admin";

  return (
    <DashboardShell active="/dashboard/admin/plans">
      <PageHeader title="Membership plans" subtitle="Names, pricing, durations and limits — all enforced server-side from these rows." />
      {!isSuper && <div className="mb-5"><Alert tone="warning">You can view plans, but only a super admin can edit them.</Alert></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const planEnts = ents.filter((e) => e.planId === plan.id);
          return (
            <Card key={plan.id}>
              <CardHeader
                title={plan.name}
                subtitle={`${plan.audience.replace("_", " ")} · ${formatMoney(plan.priceMonthly)}/mo · ${formatMoney(plan.priceYearly)}/yr`}
                action={<Badge tone={plan.isActive ? "green" : "gray"}>{plan.isActive ? "purchasable" : "hidden"}</Badge>}
              />
              <div className="p-5">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-gray-600">
                  {planEnts.map((e) => (
                    <div key={e.id} className="flex justify-between border-b border-dashed border-gray-100 py-1">
                      <span>{e.key.replace(/_/g, " ")}</span>
                      <span className="font-bold text-brand-900">{e.valueInt ?? (e.valueBool ? "yes" : "no")}</span>
                    </div>
                  ))}
                  {planEnts.length === 0 && <p className="col-span-2 text-gray-400">No entitlements configured — defaults apply.</p>}
                </div>
                {isSuper && (
                  <a href={`/dashboard/admin/plans?edit=${plan.id}`} className="mt-4 inline-block text-xs font-bold text-brand-700 hover:text-brand-900">
                    Edit this plan →
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {isSuper && (
        <div className="mt-8 space-y-6">
          {editPlan ? (
            <>
              <h2 className="text-lg font-extrabold text-brand-950">Editing: {editPlan.name}</h2>
              <PlanEditor plan={editPlan} entitlements={ents.filter((e) => e.planId === editPlan.id)} />
            </>
          ) : (
            <>
              <h2 className="text-lg font-extrabold text-brand-950">Create new plan</h2>
              <PlanEditor />
            </>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
