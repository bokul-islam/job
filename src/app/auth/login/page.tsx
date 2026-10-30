import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

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
