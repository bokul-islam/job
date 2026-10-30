import { ForgotForm } from "@/components/auth-forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-950">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">Enter your account email and we&apos;ll send a secure reset link (valid 60 minutes).</p>
      <ForgotForm />
    </div>
  );
}
