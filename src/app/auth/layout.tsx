import Link from "next/link";
import { Logo } from "@/components/chrome";
import { ShieldCheck, Clock3, Video } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr,1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-brand-600/30 blur-3xl" />
          <div className="absolute bottom-10 right-0 h-80 w-80 rounded-full bg-accent-500/20 blur-3xl" />
        </div>
        <Logo light />
        <div className="relative">
          <h2 className="text-3xl font-extrabold leading-tight text-white">
            The marketplace where <span className="text-accent-300">responsiveness</span> is measured, not promised.
          </h2>
          <div className="mt-8 space-y-4">
            <Point icon={<ShieldCheck className="h-5 w-5" />} title="Verified by default" body="Email verification, server-side role checks and private file storage are enforced everywhere." />
            <Point icon={<Clock3 className="h-5 w-5" />} title="Response-time analytics" body="Both employers and candidates carry a public, tamper-proof responsiveness score." />
            <Point icon={<Video className="h-5 w-5" />} title="Video CVs" body="Two-minute video introductions stored privately with permission-checked playback." />
          </div>
        </div>
        <p className="relative text-xs text-brand-300">© {new Date().getFullYear()} TalentBridge</p>
      </div>
      <div className="flex items-center justify-center bg-white px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden"><Logo /></div>
          {children}
          <p className="mt-8 text-center text-xs text-gray-400">
            <Link href="/" className="font-semibold text-brand-600 hover:text-brand-800">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Point({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-accent-300">{icon}</span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-brand-200">{body}</p>
      </div>
    </div>
  );
}
