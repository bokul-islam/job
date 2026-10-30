import { SiteHeader, SiteFooter } from "@/components/chrome";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold text-brand-950">Privacy policy</h1>
        <p className="mt-2 text-xs text-gray-400">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        <div className="prose-lite mt-8 space-y-4 text-sm leading-relaxed text-gray-600">
          <h3>Data we collect</h3>
          <p>Account data (name, email, hashed password), profile information, resumes and video CVs you upload, job applications, messages, and usage events such as response-time measurements.</p>
          <h3>How we use it</h3>
          <p>To operate the marketplace: matching candidates with employers, verifying accounts, computing response-time analytics, preventing abuse, and processing subscriptions.</p>
          <h3>Response-time metrics</h3>
          <p>Message-response events are aggregated into statistics shown to other users (e.g. average response time). They are computed automatically and cannot be edited manually.</p>
          <h3>Files and videos</h3>
          <p>Resumes and video CVs are private by default and are only served through permission-checked URLs. You control video CV visibility (private / verified employers / public).</p>
          <h3>Sharing</h3>
          <p>Employers see candidate profiles and resumes when you apply. Candidates see employer profiles and job posts. Admins can review content for moderation purposes only.</p>
          <h3>Retention & deletion</h3>
          <p>You may delete resumes, video CVs, and conversations at any time. Account deletion removes personal data subject to legal record-keeping obligations.</p>
          <h3>Contact</h3>
          <p>privacy@talentbridge.dev</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
