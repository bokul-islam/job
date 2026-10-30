import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4">
      <div className="mx-auto w-full max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <SearchX className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-brand-950">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Go home
          </Link>
          <Link href="/jobs" className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Browse jobs
          </Link>
        </div>
      </div>
    </div>
  );
}
