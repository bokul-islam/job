import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "@/components/auth-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;

  try {
    const user = await getSessionUser();
    if (user) redirect("/dashboard");
  } catch {
    /* DB not available — show register page, action will handle errors */
  }

  const role = sp.role === "employer" ? "employer" : "job_seeker";

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-950">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">Free forever plan. Upgrade any time for video CVs, more applications and featured placement.</p>
      <RegisterForm defaultRole={role} />
    </div>
  );
}
