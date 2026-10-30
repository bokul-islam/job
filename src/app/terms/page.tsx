import { SiteHeader, SiteFooter } from "@/components/chrome";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold text-brand-950">Terms of service</h1>
        <p className="mt-2 text-xs text-gray-400">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        <div className="prose-lite mt-8 space-y-4 text-sm leading-relaxed text-gray-600">
          <h3>Accounts</h3>
          <p>You must register with accurate information, keep credentials secure, and verify your email to access transactional features. Roles (job seeker / employer / admin) are enforced on the server on every request.</p>
          <h3>Acceptable use</h3>
          <p>No fake job postings, misleading candidate profiles, harassment, spam, or scraping. Violations may result in suspension after review by moderators.</p>
          <h3>Payments & subscriptions</h3>
          <p>Paid plans activate only after a payment provider webhook confirms your payment. Subscriptions renew monthly or yearly; cancel anytime and keep access until the period ends. This environment runs a clearly-labelled sandbox until merchant credentials are configured.</p>
          <h3>Content ownership</h3>
          <p>You own your profile, resumes and video CVs. You grant the platform a license to transmit them to recipients you authorize.</p>
          <h3>Liability</h3>
          <p>The platform connects parties but is not responsible for employment outcomes. Hiring decisions rest with employers.</p>
          <h3>Contact</h3>
          <p>legal@talentbridge.dev</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
