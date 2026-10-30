import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bookmark, Building2, CreditCard, FileText, Inbox, LayoutDashboard, LifeBuoy, Mail, Newspaper,
  Search, Settings, ShieldCheck, UserRound, Users, Video, ScrollText, SlidersHorizontal, Briefcase,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { resendVerificationAction } from "@/lib/actions/auth";
import { Logo } from "@/components/chrome";
import { Alert, Avatar, Button } from "@/components/ui";
import { NotificationBell } from "@/components/notification-bell";

type NavItem = { href: string; label: string; icon: React.ReactNode };

function navForRole(role: string): NavItem[] {
  if (role === "job_seeker") {
    return [
      { href: "/dashboard/seeker", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
      { href: "/dashboard/seeker/profile", label: "My profile", icon: <UserRound className="h-4 w-4" /> },
      { href: "/dashboard/seeker/applications", label: "Applications", icon: <FileText className="h-4 w-4" /> },
      { href: "/dashboard/seeker/saved", label: "Saved jobs", icon: <Bookmark className="h-4 w-4" /> },
      { href: "/dashboard/seeker/video-cv", label: "Video CV", icon: <Video className="h-4 w-4" /> },
      { href: "/jobs", label: "Find jobs", icon: <Search className="h-4 w-4" /> },
      { href: "/dashboard/billing", label: "Membership", icon: <CreditCard className="h-4 w-4" /> },
    ];
  }
  if (role === "employer") {
    return [
      { href: "/dashboard/employer", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
      { href: "/dashboard/employer/jobs", label: "Job posts", icon: <Newspaper className="h-4 w-4" /> },
      { href: "/dashboard/employer/candidates", label: "Find candidates", icon: <Users className="h-4 w-4" /> },
      { href: "/dashboard/employer/company", label: "Company profile", icon: <Building2 className="h-4 w-4" /> },
      { href: "/dashboard/billing", label: "Subscription", icon: <CreditCard className="h-4 w-4" /> },
    ];
  }
  return [
    { href: "/dashboard/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/dashboard/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { href: "/dashboard/admin/jobs", label: "Job moderation", icon: <ShieldCheck className="h-4 w-4" /> },
    { href: "/dashboard/admin/plans", label: "Membership plans", icon: <CreditCard className="h-4 w-4" /> },
    { href: "/dashboard/admin/reports", label: "Reports", icon: <LifeBuoy className="h-4 w-4" /> },
    { href: "/dashboard/admin/outbox", label: "Mail outbox (dev)", icon: <Mail className="h-4 w-4" /> },
    { href: "/dashboard/admin/logs", label: "Audit logs", icon: <ScrollText className="h-4 w-4" /> },
    { href: "/dashboard/admin/settings", label: "Platform settings", icon: <SlidersHorizontal className="h-4 w-4" /> },
  ];
}

export async function DashboardShell({ children, active }: { children: React.ReactNode; active: string }) {
  const user = await requireUser();
  const nav = navForRole(user.role);

  return (
    <div className="flex min-h-screen bg-[#f6f8fb]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-gray-100 px-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                active === item.href ? "bg-brand-900 text-white shadow-sm" : "text-gray-600 hover:bg-brand-50 hover:text-brand-900"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
          <div className="pt-3">
            <p className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Communication</p>
            <Link href="/inbox" className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${active === "/inbox" ? "bg-brand-900 text-white" : "text-gray-600 hover:bg-brand-50 hover:text-brand-900"}`}>
              <Inbox className="h-4 w-4" /> Inbox
            </Link>
            <Link href="/settings" className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${active === "/settings" ? "bg-brand-900 text-white" : "text-gray-600 hover:bg-brand-50 hover:text-brand-900"}`}>
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </div>
        </nav>
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{user.name}</p>
              <p className="truncate text-xs capitalize text-gray-500">{user.role.replace("_", " ")}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/85 px-4 backdrop-blur-lg sm:px-8">
          <div className="lg:hidden"><Logo /></div>
          <div className="hidden items-center gap-2 text-sm text-gray-500 lg:flex">
            <Briefcase className="h-4 w-4 text-brand-300" />
            <span className="font-medium capitalize">{user.role.replace("_", " ")} workspace</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link href="/dashboard" className="hidden text-sm font-semibold text-brand-700 hover:text-brand-900 sm:block">{user.name}</Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-6xl">
            {!user.emailVerifiedAt && !["admin", "super_admin"].includes(user.role) && (
              <div className="mb-6">
                <Alert tone="warning">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>
                      <strong>Verify your email address.</strong> Applications, job posting and messaging are locked until your
                      email is verified. {process.env.RESEND_API_KEY ? "Check your inbox." : "Development mode: open the verification link from the admin mail outbox or the server console log."}
                    </p>
                    <form action={async () => { "use server"; await resendVerificationAction(); }}>
                      <Button size="sm" variant="outline" type="submit">Resend email</Button>
                    </form>
                  </div>
                </Alert>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export async function roleRedirect(role: string) {
  if (role === "job_seeker") redirect("/dashboard/seeker");
  if (role === "employer") redirect("/dashboard/employer");
  redirect("/dashboard/admin");
}
