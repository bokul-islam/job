import { requireUser } from "@/lib/auth";
import { roleRedirect } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardIndex() {
  const user = await requireUser();
  await roleRedirect(user.role);
}
