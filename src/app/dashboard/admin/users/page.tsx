import { desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { UserStatusControls } from "@/components/admin-components";
import { Avatar, Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage users" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireRole("admin", "super_admin");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const role = sp.role ?? "";
  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = 20;

  const conditions: SQL[] = [];
  if (q) {
    const match = or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`));
    if (match) conditions.push(match);
  }
  if (role) conditions.push(eq(users.role, role as typeof users.role.enumValues[number]));
  const where = conditions.length ? sql.join(conditions, sql` and `) : undefined;

  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(where);
  const total = countRow?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  return (
    <DashboardShell active="/dashboard/admin/users">
      <PageHeader title="User management" subtitle={`${total} accounts`} />

      <Card className="mb-5 p-4">
        <form className="grid gap-3 md:grid-cols-[2fr,1fr,auto]">
          <Input name="q" defaultValue={q} placeholder="Search name or email…" />
          <Select name="role" defaultValue={role}>
            <option value="">All roles</option>
            <option value="job_seeker">Job seekers</option>
            <option value="employer">Employers</option>
            <option value="admin">Admins</option>
            <option value="super_admin">Super admins</option>
          </Select>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      <Card>
        <div className="divide-y divide-gray-100">
          {rows.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <Avatar name={u.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-gray-900">{u.name}</p>
                  <Badge tone={u.role === "super_admin" ? "purple" : u.role === "admin" ? "navy" : u.role === "employer" ? "teal" : "gray"}>{u.role.replace("_", " ")}</Badge>
                  <Badge tone={u.status === "active" ? "green" : "red"}>{u.status}</Badge>
                  <Badge tone={u.emailVerifiedAt ? "teal" : "amber"}>{u.emailVerifiedAt ? "verified" : "unverified"}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{u.email} · joined {timeAgo(u.createdAt)} · active {timeAgo(u.lastActiveAt)}</p>
              </div>
              <UserStatusControls userId={u.id} status={u.status} role={u.role} viewerRole={admin.role} isSelf={u.id === admin.id} />
            </div>
          ))}
          {rows.length === 0 && <p className="p-8 text-center text-sm text-gray-400">No users match.</p>}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            <span>Page {page} of {pageCount}</span>
            <div className="flex gap-2">
              {page > 1 && <a className="font-bold text-brand-700" href={`?q=${q}&role=${role}&page=${page - 1}`}>← Prev</a>}
              {page < pageCount && <a className="font-bold text-brand-700" href={`?q=${q}&role=${role}&page=${page + 1}`}>Next →</a>}
            </div>
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}
