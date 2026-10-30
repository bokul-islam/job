import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100)
  .regex(/[a-zA-Z]/, "Must contain a letter")
  .regex(/[0-9]/, "Must contain a number");

export const registerSchema = z.object({
  name: z.string().min(2, "Please enter your full name").max(80),
  email: z.string().email("Enter a valid email address").max(120),
  password: passwordSchema,
  role: z.enum(["job_seeker", "employer"]),
  companyName: z.string().min(2, "Company name is required").max(120).optional(),
  acceptTerms: z.literal(true, { error: "You must accept the terms to continue" }),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const seekerProfileSchema = z.object({
  headline: z.string().max(120).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  website: z.string().url("Enter a valid URL").max(200).optional().or(z.literal("")),
  currentTitle: z.string().max(120).optional().or(z.literal("")),
  yearsExperience: z.coerce.number().int().min(0).max(60).optional().or(z.literal("").transform(() => undefined)),
  expectedSalaryMin: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  expectedSalaryMax: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  availability: z.string().max(60).optional().or(z.literal("")),
  visibility: z.enum(["public", "employers", "private"]),
  skills: z.string().max(500).optional().or(z.literal("")),
});

export const companySchema = z.object({
  name: z.string().min(2).max(120),
  tagline: z.string().max(160).optional().or(z.literal("")),
  description: z.string().max(4000).optional().or(z.literal("")),
  website: z.string().url().max(200).optional().or(z.literal("")),
  industry: z.string().max(80).optional().or(z.literal("")),
  size: z.string().max(40).optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  foundedYear: z.coerce.number().int().min(1800).max(2100).optional().or(z.literal("").transform(() => undefined)),
});

export const jobSchema = z.object({
  title: z.string().min(4, "Title must be at least 4 characters").max(140),
  categoryId: z.string().uuid("Select a category").optional().or(z.literal("")),
  jobType: z.enum(["full_time", "part_time", "contract", "internship", "temporary"]),
  workplaceType: z.enum(["remote", "hybrid", "on_site"]),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead", "executive"]),
  location: z.string().min(2, "Location is required").max(120),
  salaryMin: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  salaryMax: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  salaryPeriod: z.enum(["monthly", "yearly"]).default("monthly"),
  description: z.string().min(30, "Description must be at least 30 characters").max(12000),
  responsibilities: z.string().max(8000).optional().or(z.literal("")),
  requirements: z.string().max(8000).optional().or(z.literal("")),
  benefits: z.string().max(8000).optional().or(z.literal("")),
  vacancies: z.coerce.number().int().min(1).max(500).default(1),
  deadline: z.string().optional().or(z.literal("")),
  skillNames: z.string().max(500).optional().or(z.literal("")),
  allowReapply: z.coerce.boolean().default(false),
  action: z.enum(["draft", "publish"]).default("draft"),
});

export const applySchema = z.object({
  jobId: z.string().uuid(),
  resumeId: z.string().uuid().optional().or(z.literal("")),
  coverLetter: z.string().max(6000).optional().or(z.literal("")),
});

export const messageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1, "Message cannot be empty").max(4000),
  attachmentKey: z.string().max(500).optional().or(z.literal("")),
  attachmentName: z.string().max(200).optional().or(z.literal("")),
  attachmentSize: z.coerce.number().int().min(0).optional().or(z.literal("").transform(() => undefined)),
  attachmentMime: z.string().max(120).optional().or(z.literal("")),
});

export const startConversationSchema = z.object({
  recipientId: z.string().uuid(),
  jobId: z.string().uuid().optional().or(z.literal("")),
  applicationId: z.string().uuid().optional().or(z.literal("")),
  body: z.string().min(1, "Write a message to start the conversation").max(4000),
});

export const reportSchema = z.object({
  targetType: z.enum(["job", "user", "message", "company"]),
  targetId: z.string().uuid(),
  reason: z.string().min(3).max(120),
  details: z.string().max(2000).optional().or(z.literal("")),
});

export const planSchema = z.object({
  name: z.string().min(2).max(60),
  audience: z.enum(["job_seeker", "employer"]),
  priceMonthly: z.coerce.number().int().min(0),
  priceYearly: z.coerce.number().int().min(0),
  description: z.string().max(300).optional().or(z.literal("")),
  features: z.string().max(2000).optional().or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
  entitlements: z.object({
    applications_per_month: z.coerce.number().int().min(0).optional(),
    active_job_posts: z.coerce.number().int().min(0).optional(),
    messages_per_day: z.coerce.number().int().min(0).optional(),
    candidate_searches_per_day: z.coerce.number().int().min(0).optional(),
    video_cv: z.coerce.boolean().optional(),
    featured_candidate: z.coerce.boolean().optional(),
    advanced_analytics: z.coerce.boolean().optional(),
    featured_jobs: z.coerce.boolean().optional(),
  }),
});
