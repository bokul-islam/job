import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmailAction } from "@/lib/actions/auth";
import { LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  const result = token ? await verifyEmailAction(token) : { error: "Missing verification token." };

  return (
    <div className="text-center">
      {result.success ? (
        <>
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-extrabold text-brand-950">Email verified</h1>
          <p className="mb-6 mt-2 text-sm text-gray-500">{result.success}</p>
          <LinkButton href="/dashboard">Go to your dashboard</LinkButton>
        </>
      ) : (
        <>
          <XCircle className="mx-auto h-14 w-14 text-red-400" />
          <h1 className="mt-4 text-2xl font-extrabold text-brand-950">Verification failed</h1>
          <p className="mb-6 mt-2 text-sm text-gray-500">{result.error}</p>
          <Link href="/dashboard" className="text-sm font-semibold text-brand-600 hover:text-brand-800">Request a new link from your dashboard →</Link>
        </>
      )}
    </div>
  );
}
