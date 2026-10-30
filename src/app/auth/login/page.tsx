import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;

  // If DB is down, still show the login form — the submit action will surface the real error
  try {
    const user = await getSessionUser();
    if (user) redirect("/dashboard");
  } catch {
    /* DB not available — show login page anyway, action will handle the error */
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-950">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">Sign in to your TalentBridge account.</p>
      {sp.error === "suspended" && <div className="mb-4"><Alert tone="error">This account is suspended. Contact support.</Alert></div>}
      {sp.reset && <div className="mb-4"><Alert tone="success">Password updated — sign in with your new password.</Alert></div>}
      <LoginForm next={sp.next} />
    </div>
  );
}
