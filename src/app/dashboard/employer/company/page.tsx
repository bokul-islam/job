import { requireRole } from "@/lib/auth";
import { employerProfileFor, companyProfileCompletion } from "@/lib/queries";
import { DashboardShell } from "@/components/dashboard-shell";
import { CompanyForm } from "@/components/profile-forms";
import { Badge, Card, CardHeader, LinkButton, PageHeader, Progress } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Company profile" };

export default async function CompanyPage() {
  const user = await requireRole("employer");
  const employer = await employerProfileFor(user.id);
  const company = employer?.company ?? null;
  const completion = await companyProfileCompletion(company?.id ?? null);

  return (
    <DashboardShell active="/dashboard/employer/company">
      <PageHeader
        title="Company profile"
        subtitle="Candidates see this on every job post and your public page."
        actions={company ? <LinkButton href={`/employers/${company.slug}`} variant="outline" size="sm">View public page</LinkButton> : undefined}
      />
      <Card className="mb-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-brand-900">Profile completeness</p>
            <p className="text-xs text-gray-500">Verified, complete company pages get more qualified applicants.</p>
          </div>
          <Badge tone={completion >= 70 ? "teal" : "amber"}>{completion}%</Badge>
        </div>
        <Progress value={completion} className="mt-3" />
      </Card>
      <CompanyForm company={company} />
      <Card className="mt-6">
        <CardHeader title="Verification" />
        <div className="p-5 text-sm text-gray-600">
          {company?.verified ? (
            <p className="font-semibold text-accent-700">Your company is verified by the TalentBridge team.</p>
          ) : (
            <p>Company verification is performed by the platform admins after your first job post is reviewed. Keep your profile complete to speed it up.</p>
          )}
        </div>
      </Card>
    </DashboardShell>
  );
}
