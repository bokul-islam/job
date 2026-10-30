"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDbError =
    error.message?.includes("DATABASE_URL") ||
    error.message?.includes("ECONNREFUSED") ||
    error.message?.includes("connect ETIMEDOUT") ||
    error.message?.includes("relation") ||
    error.message?.includes("does not exist");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-gray-900">
          {isDbError ? "Database connection issue" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          {isDbError ? (
            <>
              The app couldn&apos;t reach the database. If you just deployed, make sure{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-800">
                DATABASE_URL
              </code>{" "}
              is set in <strong>Vercel → Project → Settings → Environment Variables</strong>, then{" "}
              <strong>Redeploy</strong>. You also need to run{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-800">
                npx drizzle-kit push
              </code>{" "}
              once against the remote database to create the tables.
            </>
          ) : (
            <>
              An unexpected error occurred. Please try again or contact the administrator.
              {error.digest && (
                <span className="mt-1 block text-xs text-gray-400">
                  Error ID: {error.digest}
                </span>
              )}
            </>
          )}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Go home
          </a>
        </div>

        {isDbError && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-xs text-amber-800">
            <p className="font-bold">Quick setup checklist:</p>
            <ol className="mt-2 list-inside list-decimal space-y-1">
              <li>
                Create a free Supabase project at{" "}
                <a href="https://supabase.com" className="underline" target="_blank" rel="noreferrer">
                  supabase.com
                </a>
              </li>
              <li>
                Copy the <strong>Connection string (URI)</strong> from Settings → Database
              </li>
              <li>
                Add it as <code>DATABASE_URL</code> in Vercel → Project → Settings → Environment Variables
              </li>
              <li>
                Run{" "}
                <code>npx drizzle-kit push</code> locally pointing at the Supabase URL to create tables
              </li>
              <li>
                Optionally run{" "}
                <code>npx tsx src/db/seed.ts</code> for demo data
              </li>
              <li>Redeploy on Vercel</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
