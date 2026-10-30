import Link from "next/link";
import { BriefcaseBusiness, ChevronDown, LayoutDashboard, LogOut, Settings, UserRound } from "lucide-react";
import { getSessionUser, destroySession } from "@/lib/auth";
import { Avatar, LinkButton } from "@/components/ui";
import { NotificationBell } from "@/components/notification-bell";
import { redirect } from "next/navigation";

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${light ? "bg-white/10 text-accent-300" : "bg-brand-900 text-accent-300"}`}>
        <BriefcaseBusiness className="h-5 w-5" />
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-brand-950"}`}>
        Talent<span className="text-accent-500">Bridge</span>
      </span>
    </Link>
  );
}

export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-gray-600 md:flex">
          <Link href="/jobs" className="transition hover:text-brand-900">Find jobs</Link>
          <Link href="/pricing" className="transition hover:text-brand-900">Membership</Link>
          <Link href="/employers" className="transition hover:text-brand-900">Employers</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <NotificationBell />
              <div className="group relative">
                <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-brand-50">
                  <Avatar name={user.name} size="sm" />
                  <span className="hidden max-w-28 truncate text-sm font-semibold text-gray-800 sm:block">{user.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
                <div className="invisible absolute right-0 z-50 w-52 translate-y-1 rounded-xl border border-gray-200 bg-white p-1.5 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <MenuLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
                  <MenuLink href="/inbox" icon={<UserRound className="h-4 w-4" />} label="Messages" />
                  <MenuLink href="/settings" icon={<Settings className="h-4 w-4" />} label="Settings" />
                  <form
                    action={async () => {
                      "use server";
                      await destroySession();
                      redirect("/");
                    }}
                  >
                    <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </form>
                </div>
              </div>
            </>
          ) : (
            <>
              <LinkButton href="/auth/login" variant="ghost" size="sm">Sign in</LinkButton>
              <LinkButton href="/auth/register" size="sm">Get started</LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-brand-50 hover:text-brand-900">
      {icon} {label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-brand-950 text-brand-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-brand-200">
            Where great careers meet great companies. Verified profiles, real response-time data, secure messaging.
          </p>
        </div>
        <FooterCol title="Job seekers" links={[["Browse jobs", "/jobs"], ["Create profile", "/auth/register"], ["Membership plans", "/pricing"], ["Video CV studio", "/dashboard/seeker/video-cv"]]} />
        <FooterCol title="Employers" links={[["Post a job", "/auth/register?role=employer"], ["Find candidates", "/dashboard/employer/candidates"], ["Employer plans", "/pricing"], ["Hiring analytics", "/dashboard/employer"]]} />
        <FooterCol title="Company" links={[["About", "/#how-it-works"], ["Privacy policy", "/privacy"], ["Terms of service", "/terms"], ["Contact", "mailto:support@talentbridge.dev"]]} />
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-brand-300">
        © {new Date().getFullYear()} TalentBridge. Development build — demo data is clearly labelled.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-bold text-white">{title}</p>
      <ul className="mt-3 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-brand-200 transition hover:text-white">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
