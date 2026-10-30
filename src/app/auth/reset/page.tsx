import { ResetForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-950">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">Your existing sessions will be signed out.</p>
      {!token ? <Alert tone="error">Missing reset token. Request a new link from the forgot-password page.</Alert> : <ResetForm token={token} />}
    </div>
  );
}
