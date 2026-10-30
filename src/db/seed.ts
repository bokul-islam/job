/**
 * Development seed — clearly-labelled demo data.
 * Run: npx tsx src/db/seed.ts   (idempotent: wipes public tables first)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import {
  activityLogs, applications, applicationStatusHistory, companies, companyMembers,
  conversationParticipants, conversations, education, emailLogs, emailRelayLogs,
  employerProfiles, jobCategories, jobs, jobSeekerProfiles, jobSeekerSkills, jobSkills,
  membershipPlans, messages, notificationPreferences, notifications, payments,
  paymentWebhookEvents, planEntitlements, platformSettings, reports, responseEvents,
  responseMetrics, resumes, reviews, savedJobs, sessions, skills, subscriptions, users,
  verificationTokens, videoCvs, workExperience, auditLogs,
} from "./schema";
import { hashPassword } from "@/lib/passwords";

const PASSWORD = "Password123";
const h = hashPassword(PASSWORD);
const now = Date.now();
const mins = (m: number) => new Date(now - m * 60_000);

function demoPdf(title: string): Buffer {
  const content = `BT /F1 22 Tf 72 740 Td (${title}) Tj 0 -30 Td /F1 12 Tf (Development seed resume - not a real person) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  body += xref + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

async function main() {
  console.log("Wiping public tables…");
  await db.delete(applicationStatusHistory);
  await db.delete(responseEvents);
  await db.delete(responseMetrics);
  await db.delete(messages);
  await db.delete(emailRelayLogs);
  await db.delete(conversationParticipants);
  await db.delete(conversations);
  await db.delete(applications);
  await db.delete(savedJobs);
  await db.delete(jobSkills);
  await db.delete(jobs);
  await db.delete(jobSeekerSkills);
  await db.delete(education);
  await db.delete(workExperience);
  await db.delete(resumes);
  await db.delete(videoCvs);
  await db.delete(reviews);
  await db.delete(reports);
  await db.delete(notifications);
  await db.delete(notificationPreferences);
  await db.delete(paymentWebhookEvents);
  await db.delete(payments);
  await db.delete(subscriptions);
  await db.delete(planEntitlements);
  await db.delete(membershipPlans);
  await db.delete(jobCategories);
  await db.delete(skills);
  await db.delete(employerProfiles);
  await db.delete(companyMembers);
  await db.delete(companies);
  await db.delete(jobSeekerProfiles);
  await db.delete(verificationTokens);
  await db.delete(sessions);
  await db.delete(emailLogs);
  await db.delete(activityLogs);
  await db.delete(auditLogs);
  await db.delete(platformSettings);
  await db.delete(users);

  console.log("Settings…");
  await db.insert(platformSettings).values([
    { key: "platform_name", value: "TalentBridge", description: "Public product name" },
    { key: "video_max_size_mb", value: "50", description: "Video CV max upload size (MB)" },
    { key: "video_max_duration_seconds", value: "120", description: "Video CV max duration (s)" },
    { key: "allow_signups", value: "true", description: "Toggle registration" },
  ]);

  console.log("Categories & skills…");
  const categoryNames = [
    ["Engineering", "engineering"], ["Design", "design"], ["Marketing", "marketing"], ["Sales", "sales"],
    ["Finance", "finance"], ["Human Resources", "human-resources"], ["Customer Support", "customer-support"],
    ["Data & Analytics", "data-analytics"], ["Product", "product"], ["Education", "education"],
  ] as const;
  const catRows = await db.insert(jobCategories).values(categoryNames.map(([name, slug]) => ({ name, slug }))).returning();
  const catBySlug = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));

  const skillNames = ["React", "TypeScript", "Node.js", "PostgreSQL", "Figma", "UI Design", "SEO", "Content Marketing", "SQL", "Data Analysis", "Project Management", "Communication"];
  const skillRows = await db.insert(skills).values(skillNames.map((name) => ({ name }))).returning();
  const skillByName = Object.fromEntries(skillRows.map((s) => [s.name, s.id]));

  console.log("Membership plans…");
  async function plan(input: {
    name: string; slug: string; audience: "job_seeker" | "employer"; monthly: number; yearly: number;
    description: string; features: string[]; order: number;
    ents: { key: string; int?: number; bool?: boolean }[];
  }) {
    const [p] = await db.insert(membershipPlans).values({
      name: input.name, slug: input.slug, audience: input.audience,
      priceMonthly: input.monthly, priceYearly: input.yearly,
      description: input.description, features: input.features, sortOrder: input.order,
    }).returning();
    if (input.ents.length) {
      await db.insert(planEntitlements).values(input.ents.map((e) => ({
        planId: p.id, key: e.key, valueInt: e.int ?? null, valueBool: e.bool ?? null,
      })));
    }
    return p;
  }

  await plan({
    name: "Free", slug: "seeker-free", audience: "job_seeker", monthly: 0, yearly: 0, order: 0,
    description: "Get started with the essentials.",
    features: ["10 applications per month", "PDF resume uploads", "Basic job search & filters", "10 messages per day"],
    ents: [
      { key: "applications_per_month", int: 10 }, { key: "messages_per_day", int: 10 }, { key: "video_cv", bool: false },
    ],
  });
  const seekerStandard = await plan({
    name: "Standard", slug: "seeker-standard", audience: "job_seeker", monthly: 490, yearly: 4900, order: 1,
    description: "For active candidates who want to stand out.",
    features: ["50 applications per month", "Video CV (2 minutes)", "50 messages per day", "Priority in employer search"],
    ents: [
      { key: "applications_per_month", int: 50 }, { key: "messages_per_day", int: 50 }, { key: "video_cv", bool: true },
    ],
  });
  const seekerPremium = await plan({
    name: "Premium", slug: "seeker-premium", audience: "job_seeker", monthly: 990, yearly: 9900, order: 2,
    description: "Maximum visibility and analytics.",
    features: ["300 applications per month", "Featured candidate badge", "200 messages per day", "Advanced profile analytics", "Video CV (2 minutes)"],
    ents: [
      { key: "applications_per_month", int: 300 }, { key: "messages_per_day", int: 200 }, { key: "video_cv", bool: true },
      { key: "featured_candidate", bool: true }, { key: "advanced_analytics", bool: true },
    ],
  });
  await plan({
    name: "Free", slug: "employer-free", audience: "employer", monthly: 0, yearly: 0, order: 0,
    description: "Try hiring with one live post.",
    features: ["1 active job post", "Basic applicant management", "10 candidate searches/day", "10 messages per day"],
    ents: [
      { key: "active_job_posts", int: 1 }, { key: "candidate_searches_per_day", int: 10 }, { key: "messages_per_day", int: 10 },
    ],
  });
  const employerStandard = await plan({
    name: "Standard", slug: "employer-standard", audience: "employer", monthly: 1990, yearly: 19900, order: 1,
    description: "For growing teams hiring monthly.",
    features: ["10 active job posts", "100 candidate searches/day", "Hiring analytics", "100 messages per day"],
    ents: [
      { key: "active_job_posts", int: 10 }, { key: "candidate_searches_per_day", int: 100 }, { key: "messages_per_day", int: 100 }, { key: "advanced_analytics", bool: true },
    ],
  });
  const employerPremium = await plan({
    name: "Premium", slug: "employer-premium", audience: "employer", monthly: 4990, yearly: 49900, order: 2,
    description: "Full recruitment suite with featured placement.",
    features: ["50 active job posts", "500 candidate searches/day", "Featured job posts", "Advanced analytics", "500 messages per day"],
    ents: [
      { key: "active_job_posts", int: 50 }, { key: "candidate_searches_per_day", int: 500 }, { key: "messages_per_day", int: 500 },
      { key: "advanced_analytics", bool: true }, { key: "featured_jobs", bool: true },
    ],
  });

  console.log("Users…");
  async function user(email: string, name: string, role: "job_seeker" | "employer" | "admin" | "super_admin", verified = true) {
    const [u] = await db.insert(users).values({
      email, name, role, passwordHash: h,
      emailVerifiedAt: verified ? mins(60 * 24 * 9) : null,
      lastActiveAt: mins(37),
    }).returning();
    await db.insert(notificationPreferences).values({ userId: u.id });
    return u;
  }

  await user("admin@talentbridge.dev", "Platform Admin", "admin");
  const superAdmin = await user("superadmin@talentbridge.dev", "Root Super Admin", "super_admin");

  const emp1 = await user("farhana@airtech.dev", "Farhana Akter", "employer");
  const emp2 = await user("tanvir@finplus.dev", "Tanvir Hasan", "employer");
  const seeker1 = await user("nabila.dev@example.com", "Nabila Rahman", "job_seeker");
  const seeker2 = await user("rakib.ui@example.com", "Rakib Hossain", "job_seeker");
  const seeker3 = await user("sadia.data@example.com", "Sadia Islam", "job_seeker");
  await user("unverified@example.com", "Unverified Newcomer", "job_seeker", false);

  const [airtech] = await db.insert(companies).values({
    name: "AirTech Innovations", slug: "airtech-innovations",
    tagline: "IoT platforms for modern factories",
    description: "AirTech builds industrial IoT software used across 40+ factories in South Asia. We are a remote-friendly team of 60 engineers and designers.",
    website: "https://airtech.dev", industry: "Software", size: "51-200", location: "Dhaka, Bangladesh",
    foundedYear: 2018, verified: true, createdById: emp1.id,
  }).returning();
  const [finplus] = await db.insert(companies).values({
    name: "FinPlus", slug: "finplus",
    tagline: "Fintech infrastructure for SMEs",
    description: "FinPlus provides lending infrastructure to 2,000+ small businesses. Backed by regional investors, headquartered in Dhaka.",
    website: "https://finplus.dev", industry: "Fintech", size: "11-50", location: "Dhaka, Bangladesh",
    foundedYear: 2020, verified: false, createdById: emp2.id,
  }).returning();
  await db.insert(companyMembers).values([
    { companyId: airtech.id, userId: emp1.id, memberRole: "owner" },
    { companyId: finplus.id, userId: emp2.id, memberRole: "owner" },
  ]);
  await db.insert(employerProfiles).values([
    { userId: emp1.id, companyId: airtech.id, title: "Head of Talent", completionPct: 88 },
    { userId: emp2.id, companyId: finplus.id, title: "CTO", completionPct: 75 },
  ]);

  const [p1] = await db.insert(jobSeekerProfiles).values({
    userId: seeker1.id, headline: "Full-Stack Developer · React & Node.js · 4 yrs",
    bio: "Full-stack developer with 4 years of experience shipping web apps for startups. I care about measurable outcomes and fast feedback loops.",
    location: "Dhaka, Bangladesh", phone: "+8801712000001", website: "https://nabila.dev",
    currentTitle: "Software Engineer", yearsExperience: 4, expectedSalaryMin: 90000, expectedSalaryMax: 140000,
    availability: "Available in 2 weeks", visibility: "public", completionPct: 100,
  }).returning();
  const [p2] = await db.insert(jobSeekerProfiles).values({
    userId: seeker2.id, headline: "Product Designer · UX/UI · 3 yrs",
    bio: "Designer focused on SaaS dashboards and mobile flows. Previously at two seed-stage startups.",
    location: "Chattogram, Bangladesh", currentTitle: "Product Designer", yearsExperience: 3,
    expectedSalaryMin: 70000, expectedSalaryMax: 110000, availability: "Immediately available", visibility: "employers", completionPct: 89,
  }).returning();
  await db.insert(jobSeekerProfiles).values({
    userId: seeker3.id, headline: "Data Analyst · SQL & Python",
    bio: "Analyst turning messy operational data into decisions.", location: "Dhaka, Bangladesh",
    currentTitle: "Data Analyst", yearsExperience: 2, expectedSalaryMin: 60000, expectedSalaryMax: 90000,
    availability: "1 month notice", visibility: "public", completionPct: 78,
  });
  const p3Row = await db.select().from(jobSeekerProfiles);
  const p3 = p3Row.find((p) => p.userId === seeker3.id)!;

  await db.insert(jobSeekerSkills).values([
    { seekerId: p1.id, skillId: skillByName["React"] }, { seekerId: p1.id, skillId: skillByName["TypeScript"] },
    { seekerId: p1.id, skillId: skillByName["Node.js"] }, { seekerId: p1.id, skillId: skillByName["PostgreSQL"] },
    { seekerId: p2.id, skillId: skillByName["Figma"] }, { seekerId: p2.id, skillId: skillByName["UI Design"] },
    { seekerId: p3.id, skillId: skillByName["SQL"] }, { seekerId: p3.id, skillId: skillByName["Data Analysis"] },
  ]);
  await db.insert(education).values([
    { seekerId: p1.id, institution: "BUET", degree: "BSc Computer Science", field: "CSE", startYear: 2016, endYear: 2020 },
    { seekerId: p2.id, institution: "University of Dhaka", degree: "BFA Graphic Design", startYear: 2017, endYear: 2021 },
    { seekerId: p3.id, institution: "NSU", degree: "BBA Statistics", startYear: 2018, endYear: 2022 },
  ]);
  await db.insert(workExperience).values([
    { seekerId: p1.id, company: "ShopUp", title: "Software Engineer", location: "Dhaka", isCurrent: true, startDate: "Mar 2022", description: "Built merchant dashboard features used by 80k sellers." },
    { seekerId: p1.id, company: "Kaz Software", title: "Junior Developer", location: "Dhaka", isCurrent: false, startDate: "Jan 2021", endDate: "Feb 2022" },
    { seekerId: p2.id, company: "Pathao", title: "Product Designer", location: "Dhaka", isCurrent: true, startDate: "Jun 2022" },
    { seekerId: p3.id, company: "bKash Analytics", title: "Data Analyst", location: "Dhaka", isCurrent: true, startDate: "Aug 2023" },
  ]);

  // Resumes: write actual PDF files so demo downloads work
  const storageRoot = path.join(process.cwd(), "storage", "uploads");
  async function seedResume(profileId: string, ownerId: string, title: string) {
    const key = `resumes/${ownerId}/demo-${profileId.slice(0, 8)}.pdf`;
    const target = path.join(storageRoot, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, demoPdf(title));
    const size = fs.statSync(target).size;
    return db.insert(resumes).values({
      seekerId: profileId, title, fileKey: key, fileName: `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      fileSize: size, mimeType: "application/pdf", status: "ready", isPrimary: true,
    }).returning();
  }
  const [resume1] = await seedResume(p1.id, seeker1.id, "Nabila Rahman — Resume");
  await seedResume(p2.id, seeker2.id, "Rakib Hossain — Resume");
  await seedResume(p3.id, seeker3.id, "Sadia Islam — Resume");

  console.log("Jobs…");
  const jobSeed = [
    { employer: emp1, company: airtech, title: "Senior Frontend Engineer (React)", category: "engineering", type: "full_time", workplace: "hybrid", exp: "senior", location: "Dhaka, Bangladesh", min: 120000, max: 200000, featured: true, status: "active" as const, skills: ["React", "TypeScript"], desc: "Own our industrial dashboard frontend. Work with product and firmware teams to visualize live factory telemetry for thousands of operators.", resp: "• Build and ship React/TypeScript dashboard features\n• Define front-end architecture decisions\n• Mentor mid-level engineers\n• Work with design on a shared component library", req: "• 4+ years of professional React experience\n• Strong TypeScript\n• Experience with real-time data (websockets/SSE)\n• Testing mindset", ben: "• Competitive salary\n• Remote-friendly Fridays\n• Annual conference budget\n• Health insurance" },
    { employer: emp1, company: airtech, title: "Node.js Backend Engineer", category: "engineering", type: "full_time", workplace: "remote", exp: "mid", location: "Remote (Bangladesh)", min: 100000, max: 160000, status: "active" as const, skills: ["Node.js", "PostgreSQL"], desc: "Scale our ingestion APIs processing 2M+ device events per day. PostgreSQL-heavy, performance-critical work.", resp: "• Design ingestion and query APIs\n• Own database performance\n• Write integration tests", req: "• 2+ years Node.js\n• Strong SQL and Postgres\n• Familiar with queues and caching", ben: "• Remote-first\n• Learning stipend" },
    { employer: emp1, company: airtech, title: "Product Design Intern", category: "design", type: "internship", workplace: "on_site", exp: "entry", location: "Dhaka, Bangladesh", min: 15000, max: 25000, status: "active" as const, skills: ["Figma", "UI Design"], desc: "Six-month paid internship on the design team. Real product work, weekly critique, mentorship from senior designers.", resp: "• Support dashboard design iterations\n• Maintain the Figma component library", req: "• Portfolio with 2+ case studies\n• Figma fluency", ben: "• Mentorship\n• Possible conversion to full-time" },
    { employer: emp2, company: finplus, title: "Data Analyst — Credit Risk", category: "data-analytics", type: "full_time", workplace: "hybrid", exp: "mid", location: "Dhaka, Bangladesh", min: 80000, max: 130000, status: "active" as const, skills: ["SQL", "Data Analysis"], desc: "Model SME credit risk from transactional data. Direct impact on portfolio decisions.", resp: "• Build risk dashboards\n• Analyze repayment behavior\n• Present findings to leadership", req: "• Advanced SQL\n• Python or R\n• 2+ years analytics experience", ben: "• Profit sharing\n• Hybrid schedule" },
    { employer: emp2, company: finplus, title: "Merchant Sales Executive", category: "sales", type: "full_time", workplace: "on_site", exp: "entry", location: "Sylhet, Bangladesh", min: 40000, max: 60000, status: "active" as const, skills: ["Communication"], desc: "Grow our merchant network in Sylhet division. Field sales with a strong ops team behind you.", resp: "• Onboard 30+ merchants monthly\n• Run demo sessions", req: "• Bangla communication skills\n• Willingness to travel", ben: "• Commission on top of base\n• Travel allowance" },
    { employer: emp2, company: finplus, title: "Marketing Lead (B2B)", category: "marketing", type: "full_time", workplace: "hybrid", exp: "senior", location: "Dhaka, Bangladesh", min: 130000, max: 180000, status: "paused" as const, skills: ["SEO", "Content Marketing"], desc: "Lead B2B demand generation for our lending products.", resp: "• Own the demand-gen funnel\n• Manage a 2-person content team", req: "• 5+ years B2B marketing", ben: "• Leadership track" },
    { employer: emp1, company: airtech, title: "QA Engineer (Closed)", category: "engineering", type: "contract", workplace: "remote", exp: "mid", location: "Remote", min: 70000, max: 90000, status: "closed" as const, skills: ["Communication"], desc: "Filled contract role.", resp: "", req: "", ben: "" },
  ];

  const createdJobs: { id: string; employerId: string; title: string }[] = [];
  for (const [i, j] of jobSeed.entries()) {
    const [job] = await db.insert(jobs).values({
      employerId: j.employer.id, companyId: j.company.id, categoryId: catBySlug[j.category],
      title: j.title, slug: `${j.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}-seed${i}`,
      jobType: j.type as never, workplaceType: j.workplace as never, experienceLevel: j.exp as never,
      location: j.location, salaryMin: j.min, salaryMax: j.max, salaryCurrency: "BDT",
      description: j.desc, responsibilities: j.resp, requirements: j.req, benefits: j.ben,
      vacancies: i % 2 === 0 ? 2 : 1, status: j.status, featured: Boolean(j.featured),
      deadline: new Date(now + 30 * 864e5), viewsCount: 40 + i * 13,
      createdAt: mins(60 * (24 * (i + 1))),
    }).returning();
    createdJobs.push({ id: job.id, employerId: j.employer.id, title: job.title });
    for (const s of j.skills) await db.insert(jobSkills).values({ jobId: job.id, skillId: skillByName[s] });
  }

  console.log("Subscriptions & payments (sandbox records)…");
  const [sub1] = await db.insert(subscriptions).values({
    userId: emp1.id, planId: employerPremium.id, status: "active", interval: "monthly",
    startedAt: mins(60 * 24 * 12), currentPeriodEnd: new Date(now + 18 * 864e5),
  }).returning();
  await db.insert(payments).values({
    subscriptionId: sub1.id, userId: emp1.id, amount: 4990, currency: "BDT", provider: "sandbox",
    providerRef: "SBX-SEED001", status: "completed", meta: JSON.stringify({ planId: employerPremium.id, interval: "monthly" }),
    createdAt: mins(60 * 24 * 12),
  });
  const [sub2] = await db.insert(subscriptions).values({
    userId: seeker1.id, planId: seekerStandard.id, status: "active", interval: "yearly",
    startedAt: mins(60 * 24 * 40), currentPeriodEnd: new Date(now + 325 * 864e5),
  }).returning();
  await db.insert(payments).values({
    subscriptionId: sub2.id, userId: seeker1.id, amount: 4900, currency: "BDT", provider: "sandbox",
    providerRef: "SBX-SEED002", status: "completed", meta: JSON.stringify({ planId: seekerStandard.id, interval: "yearly" }),
  });
  await db.insert(paymentWebhookEvents).values({
    provider: "sandbox", eventId: "evt_seed_001",
    payload: JSON.stringify({ type: "payment.completed", data: { ref: "SBX-SEED001" } }),
    signatureOk: true, processedAt: mins(60 * 24 * 12),
  });
  void seekerPremium; void employerStandard; void superAdmin;

  console.log("Applications…");
  const statuses = ["shortlisted", "viewed", "submitted", "interview"] as const;
  const seekers = [seeker1, seeker2, seeker3];
  for (const [i, s] of seekers.entries()) {
    const job = createdJobs[i] ?? createdJobs[0];
    const [application] = await db.insert(applications).values({
      jobId: job.id, seekerId: s.id, resumeId: s.id === seeker1.id ? resume1.id : null,
      coverLetter: `Hello — I'm very interested in the ${job.title} role. My background matches your requirements and I'd love to discuss further.`,
      status: statuses[i], createdAt: mins(60 * 26),
    }).returning();
    await db.insert(applicationStatusHistory).values([
      { applicationId: application.id, toStatus: "submitted", createdAt: mins(60 * 26) },
      ...(statuses[i] !== "submitted" ? [{ applicationId: application.id, fromStatus: "submitted" as const, toStatus: "viewed" as const, changedById: job.employerId, createdAt: mins(60 * 25) }] : []),
      ...(["shortlisted", "interview"].includes(statuses[i]) ? [{ applicationId: application.id, fromStatus: "viewed" as const, toStatus: statuses[i] as "shortlisted" | "interview", changedById: job.employerId, createdAt: mins(60 * 20) }] : []),
    ]);
    await db.insert(notifications).values({
      userId: s.id, type: `application_${statuses[i]}`, title: `Application update: ${statuses[i]}`,
      body: `Your application for “${job.title}” is now ${statuses[i]}.`, url: "/dashboard/seeker/applications",
      isRead: i === 2, createdAt: mins(60 * 20),
    });
  }

  await db.insert(savedJobs).values([
    { jobId: createdJobs[1].id, seekerId: seeker1.id },
    { jobId: createdJobs[3].id, seekerId: seeker1.id },
    { jobId: createdJobs[0].id, seekerId: seeker3.id },
  ]);

  console.log("Conversations, messages & response metrics…");
  const employerLines = [
    "Hi! We reviewed your profile and would love to interview you this week.",
    "Great — how about Thursday at 3 PM?",
    "Confirmed. Calendar invite sent!",
    "One more question: are you open to hybrid work?",
  ];
  const seekerLines = [
    "Hello! Yes, I'm interested. What slots do you have?",
    "Thursday 3 PM works for me.",
    "Looking forward to it. Thank you!",
    "Hybrid works perfectly for me.",
  ];

  async function convo(employerU: typeof emp1, seekerU: typeof seeker1, exchanges: [string, number][]) {
    if (exchanges.length === 0) return null;
    const [conv] = await db.insert(conversations).values({ lastMessageAt: mins(exchanges[0]?.[1] ?? 0) }).returning();
    await db.insert(conversationParticipants).values([
      { conversationId: conv.id, userId: employerU.id, lastReadAt: new Date() },
      { conversationId: conv.id, userId: seekerU.id, lastReadAt: new Date() },
    ]);
    let lastSender = "";
    let eIdx = 0;
    let sIdx = 0;
    for (const [who, minutesAgo] of exchanges) {
      const senderId = who === "e" ? employerU.id : seekerU.id;
      const otherId = who === "e" ? seekerU.id : employerU.id;
      const text = who === "e" ? employerLines[eIdx++ % employerLines.length] : seekerLines[sIdx++ % seekerLines.length];
      const sentAt = mins(minutesAgo);
      const [msg] = await db.insert(messages).values({ conversationId: conv.id, senderId, body: text, createdAt: sentAt }).returning();

      if (lastSender && lastSender !== senderId) {
        // the previous block obligated this sender; close one open event
        const open = await db.select().from(responseEvents).where(
          and(eq(responseEvents.conversationId, conv.id), eq(responseEvents.obligatedUserId, senderId), isNull(responseEvents.answeredAt))
        );
        if (open[0]) {
          const secs = Math.max(0, Math.round((sentAt.getTime() - open[0].receivedAt.getTime()) / 1000));
          await db.update(responseEvents).set({ answeredAt: sentAt, responseSeconds: secs }).where(eq(responseEvents.id, open[0].id));
        }
      }
      // create obligation for the other party if none open
      const openForOther = await db.select().from(responseEvents).where(
        and(eq(responseEvents.conversationId, conv.id), eq(responseEvents.obligatedUserId, otherId), isNull(responseEvents.answeredAt))
      );
      if (!openForOther[0]) {
        await db.insert(responseEvents).values({ conversationId: conv.id, messageId: msg.id, obligatedUserId: otherId, receivedAt: sentAt });
      }
      lastSender = senderId;
    }
    await db.update(conversations).set({ lastMessageAt: mins(exchanges[0]?.[1] ?? 0) }).where(eq(conversations.id, conv.id));
    return conv;
  }

  // exchanges list is ordered oldest → newest
  const c1 = await convo(emp1, seeker1, [["e", 6 * 60 + 30], ["s", 4 * 60 + 15], ["e", 2 * 60 + 40], ["s", 2 * 60 + 20]] as [string, number][]);
  await convo(emp1, seeker1, []); // unused spare
  await convo(emp2, seeker3, [["s", 26 * 60], ["e", 23 * 60], ["s", 22 * 60]] as [string, number][]);
  await convo(emp1, seeker2, [["e", 50 * 60]] as [string, number][]); // unanswered

  // Recompute metrics aggregates from events
  const events = await db.select().from(responseEvents);
  const byUser = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byUser.get(e.obligatedUserId) ?? [];
    arr.push(e);
    byUser.set(e.obligatedUserId, arr);
  }
  for (const [userId, userEvents] of byUser) {
    const answered = userEvents.filter((e) => e.responseSeconds != null);
    await db.insert(responseMetrics).values({
      userId,
      totalReceived: userEvents.length,
      totalAnswered: answered.length,
      totalResponseSeconds: answered.reduce((a, b) => a + (b.responseSeconds ?? 0), 0),
      fastestSeconds: answered.length ? Math.min(...answered.map((e) => e.responseSeconds!)) : null,
      slowestSeconds: answered.length ? Math.max(...answered.map((e) => e.responseSeconds!)) : null,
      lastActiveAt: mins(30),
    });
  }
  void c1;

  console.log("Reports & welcome emails…");
  await db.insert(reports).values({
    reporterId: seeker2.id, targetType: "job", targetId: createdJobs[4].id,
    reason: "Suspicious compensation claims", details: "The salary listed seems inconsistent with the role scope.", status: "open",
  });
  await db.insert(emailLogs).values({
    toEmail: seeker1.email, subject: "Welcome to TalentBridge", template: "welcome",
    body: "<p>Demo seed entry — outbound emails are logged here in development mode.</p>", status: "logged",
  });

  console.log("Seed complete.");
  console.log("Demo credentials (password for all):", PASSWORD);
  console.log("  superadmin@talentbridge.dev / admin@talentbridge.dev");
  console.log("  farhana@airtech.dev (employer, Premium) / tanvir@finplus.dev (employer, Free)");
  console.log("  nabila.dev@example.com (seeker, Standard) / rakib.ui@example.com / sadia.data@example.com");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
