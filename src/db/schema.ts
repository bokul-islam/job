import {
  pgTable, pgEnum, uuid, text, integer, bigint, boolean, timestamp,
  uniqueIndex, index,
} from "drizzle-orm/pg-core";

/* ---------------------------------- Enums ---------------------------------- */

export const userRoleEnum = pgEnum("user_role", ["job_seeker", "employer", "admin", "super_admin"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "suspended", "deactivated"]);
export const verificationTypeEnum = pgEnum("verification_type", ["email_verify", "password_reset"]);
export const visibilityEnum = pgEnum("profile_visibility", ["public", "employers", "private"]);
export const uploadStatusEnum = pgEnum("upload_status", ["uploading", "ready", "failed"]);
export const jobTypeEnum = pgEnum("job_type", ["full_time", "part_time", "contract", "internship", "temporary"]);
export const workplaceTypeEnum = pgEnum("workplace_type", ["remote", "hybrid", "on_site"]);
export const experienceLevelEnum = pgEnum("experience_level", ["entry", "mid", "senior", "lead", "executive"]);
export const jobStatusEnum = pgEnum("job_status", ["draft", "active", "paused", "closed"]);
export const salaryPeriodEnum = pgEnum("salary_period", ["monthly", "yearly"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "submitted", "viewed", "shortlisted", "interview", "rejected", "hired", "withdrawn",
]);
export const planAudienceEnum = pgEnum("plan_audience", ["job_seeker", "employer"]);
export const billingIntervalEnum = pgEnum("billing_interval", ["monthly", "yearly"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["pending", "active", "canceled", "expired"]);
export const paymentStatusEnum = pgEnum("payment_status", ["initiated", "completed", "failed", "refunded"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["sandbox", "sslcommerz", "bkash"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "reviewing", "resolved", "dismissed"]);
export const reportTargetEnum = pgEnum("report_target", ["job", "user", "message", "company"]);
export const emailStatusEnum = pgEnum("email_status", ["queued", "logged", "sent", "failed"]);

/* ---------------------------------- Auth ---------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("job_seeker"),
  status: accountStatusEnum("status").notNull().default("active"),
  emailVerifiedAt: timestamp("email_verified_at"),
  avatarKey: text("avatar_key"),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)]);

export const verificationTokens = pgTable("verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  type: verificationTypeEnum("type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("verification_tokens_user_idx").on(t.userId)]);

/* --------------------------------- Profiles -------------------------------- */

export const jobSeekerProfiles = pgTable("job_seeker_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  headline: text("headline"),
  bio: text("bio"),
  location: text("location"),
  phone: text("phone"),
  website: text("website"),
  currentTitle: text("current_title"),
  yearsExperience: integer("years_experience"),
  expectedSalaryMin: integer("expected_salary_min"),
  expectedSalaryMax: integer("expected_salary_max"),
  availability: text("availability"),
  visibility: visibilityEnum("visibility").notNull().default("public"),
  completionPct: integer("completion_pct").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("job_seeker_profiles_user_idx").on(t.userId)]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  website: text("website"),
  industry: text("industry"),
  size: text("size"),
  location: text("location"),
  foundedYear: integer("founded_year"),
  logoKey: text("logo_key"),
  verified: boolean("verified").notNull().default(false),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("companies_slug_idx").on(t.slug)]);

export const companyMembers = pgTable("company_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  memberRole: text("member_role").notNull().default("owner"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("company_members_unique").on(t.companyId, t.userId)]);

export const employerProfiles = pgTable("employer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  title: text("title"),
  phone: text("phone"),
  completionPct: integer("completion_pct").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("employer_profiles_user_idx").on(t.userId)]);

export const education = pgTable("education", {
  id: uuid("id").primaryKey().defaultRandom(),
  seekerId: uuid("seeker_id").notNull().references(() => jobSeekerProfiles.id, { onDelete: "cascade" }),
  institution: text("institution").notNull(),
  degree: text("degree").notNull(),
  field: text("field"),
  startYear: integer("start_year"),
  endYear: integer("end_year"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("education_seeker_idx").on(t.seekerId)]);

export const workExperience = pgTable("work_experience", {
  id: uuid("id").primaryKey().defaultRandom(),
  seekerId: uuid("seeker_id").notNull().references(() => jobSeekerProfiles.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  title: text("title").notNull(),
  location: text("location"),
  isCurrent: boolean("is_current").notNull().default(false),
  startDate: text("start_date"),
  endDate: text("end_date"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("work_experience_seeker_idx").on(t.seekerId)]);

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("skills_name_idx").on(t.name)]);

export const jobSeekerSkills = pgTable("job_seeker_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  seekerId: uuid("seeker_id").notNull().references(() => jobSeekerProfiles.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  level: text("level").notNull().default("intermediate"),
}, (t) => [uniqueIndex("job_seeker_skills_unique").on(t.seekerId, t.skillId)]);

/* --------------------------------- Files ----------------------------------- */

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  seekerId: uuid("seeker_id").notNull().references(() => jobSeekerProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  status: uploadStatusEnum("status").notNull().default("uploading"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("resumes_seeker_idx").on(t.seekerId), uniqueIndex("resumes_file_key_idx").on(t.fileKey)]);

export const videoCvs = pgTable("video_cvs", {
  id: uuid("id").primaryKey().defaultRandom(),
  seekerId: uuid("seeker_id").notNull().references(() => jobSeekerProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  durationSeconds: integer("duration_seconds"),
  visibility: visibilityEnum("visibility").notNull().default("employers"),
  status: uploadStatusEnum("status").notNull().default("uploading"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("video_cvs_seeker_idx").on(t.seekerId), uniqueIndex("video_cvs_file_key_idx").on(t.fileKey)]);

/* ---------------------------------- Jobs ----------------------------------- */

export const jobCategories = pgTable("job_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  icon: text("icon"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("job_categories_name_idx").on(t.name), uniqueIndex("job_categories_slug_idx").on(t.slug)]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  employerId: uuid("employer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => jobCategories.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  jobType: jobTypeEnum("job_type").notNull().default("full_time"),
  workplaceType: workplaceTypeEnum("workplace_type").notNull().default("on_site"),
  experienceLevel: experienceLevelEnum("experience_level").notNull().default("mid"),
  location: text("location").notNull(),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryCurrency: text("salary_currency").notNull().default("BDT"),
  salaryPeriod: salaryPeriodEnum("salary_period").notNull().default("monthly"),
  description: text("description").notNull(),
  responsibilities: text("responsibilities"),
  requirements: text("requirements"),
  benefits: text("benefits"),
  vacancies: integer("vacancies").notNull().default(1),
  deadline: timestamp("deadline"),
  status: jobStatusEnum("status").notNull().default("draft"),
  allowReapply: boolean("allow_reapply").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  flagged: boolean("flagged").notNull().default(false),
  viewsCount: integer("views_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("jobs_slug_idx").on(t.slug),
  index("jobs_status_idx").on(t.status),
  index("jobs_category_idx").on(t.categoryId),
  index("jobs_employer_idx").on(t.employerId),
  index("jobs_created_idx").on(t.createdAt),
  index("jobs_location_idx").on(t.location),
]);

export const jobSkills = pgTable("job_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
}, (t) => [uniqueIndex("job_skills_unique").on(t.jobId, t.skillId)]);

/* ------------------------------- Applications ------------------------------ */

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  seekerId: uuid("seeker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
  coverLetter: text("cover_letter"),
  status: applicationStatusEnum("status").notNull().default("submitted"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("applications_job_seeker_unique").on(t.jobId, t.seekerId),
  index("applications_seeker_idx").on(t.seekerId),
  index("applications_job_idx").on(t.jobId),
  index("applications_status_idx").on(t.status),
]);

export const applicationStatusHistory = pgTable("application_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  fromStatus: applicationStatusEnum("from_status"),
  toStatus: applicationStatusEnum("to_status").notNull(),
  changedById: uuid("changed_by_id").references(() => users.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("app_status_history_app_idx").on(t.applicationId)]);

export const savedJobs = pgTable("saved_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  seekerId: uuid("seeker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("saved_jobs_unique").on(t.jobId, t.seekerId)]);

/* -------------------------------- Messaging --------------------------------- */

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  subject: text("subject"),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationParticipants = pgTable("conversation_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at"),
  blocked: boolean("blocked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("conv_participants_unique").on(t.conversationId, t.userId),
  index("conv_participants_user_idx").on(t.userId),
]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  attachmentKey: text("attachment_key"),
  attachmentName: text("attachment_name"),
  attachmentSize: integer("attachment_size"),
  attachmentMime: text("attachment_mime"),
  isAutomated: boolean("is_automated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("messages_conversation_idx").on(t.conversationId, t.createdAt),
  index("messages_sender_idx").on(t.senderId),
]);

export const emailRelayLogs = pgTable("email_relay_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  direction: text("direction").notNull(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  status: text("status").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------- Notifications ----------------------------- */

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  url: text("url"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.isRead)]);

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  inAppMessages: boolean("in_app_messages").notNull().default(true),
  inAppApplications: boolean("in_app_applications").notNull().default(true),
  inAppJobAlerts: boolean("in_app_job_alerts").notNull().default(true),
  inAppMembership: boolean("in_app_membership").notNull().default(true),
  emailMessages: boolean("email_messages").notNull().default(true),
  emailApplications: boolean("email_applications").notNull().default(true),
  emailJobAlerts: boolean("email_job_alerts").notNull().default(false),
  emailMembership: boolean("email_membership").notNull().default(true),
}, (t) => [uniqueIndex("notification_prefs_user_idx").on(t.userId)]);

/* -------------------------------- Membership -------------------------------- */

export const membershipPlans = pgTable("membership_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  audience: planAudienceEnum("audience").notNull(),
  priceMonthly: integer("price_monthly").notNull().default(0),
  priceYearly: integer("price_yearly").notNull().default(0),
  currency: text("currency").notNull().default("BDT"),
  description: text("description"),
  features: text("features").array(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("membership_plans_slug_idx").on(t.slug)]);

export const planEntitlements = pgTable("plan_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => membershipPlans.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  valueInt: integer("value_int"),
  valueBool: boolean("value_bool"),
}, (t) => [uniqueIndex("plan_entitlements_unique").on(t.planId, t.key)]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => membershipPlans.id, { onDelete: "restrict" }),
  status: subscriptionStatusEnum("status").notNull().default("pending"),
  interval: billingIntervalEnum("interval").notNull().default("monthly"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("subscriptions_user_idx").on(t.userId, t.status)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("BDT"),
  provider: paymentProviderEnum("provider").notNull().default("sandbox"),
  providerRef: text("provider_ref"),
  status: paymentStatusEnum("status").notNull().default("initiated"),
  meta: text("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("payments_user_idx").on(t.userId)]);

export const paymentWebhookEvents = pgTable("payment_webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: paymentProviderEnum("provider").notNull(),
  eventId: text("event_id").notNull(),
  payload: text("payload").notNull(),
  signatureOk: boolean("signature_ok").notNull().default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("payment_webhook_unique").on(t.provider, t.eventId)]);

/* ----------------------------- Response metrics ----------------------------- */

export const responseEvents = pgTable("response_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  obligatedUserId: uuid("obligated_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receivedAt: timestamp("received_at").notNull(),
  answeredAt: timestamp("answered_at"),
  responseSeconds: integer("response_seconds"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("response_events_user_idx").on(t.obligatedUserId),
  index("response_events_open_idx").on(t.conversationId, t.obligatedUserId),
]);

export const responseMetrics = pgTable("response_metrics", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  totalReceived: integer("total_received").notNull().default(0),
  totalAnswered: integer("total_answered").notNull().default(0),
  totalResponseSeconds: bigint("total_response_seconds", { mode: "number" }).notNull().default(0),
  fastestSeconds: integer("fastest_seconds"),
  slowestSeconds: integer("slowest_seconds"),
  lastActiveAt: timestamp("last_active_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------- Moderation / audit / misc ------------------------ */

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: reportTargetEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: reportStatusEnum("status").notNull().default("open"),
  resolutionNote: text("resolution_note"),
  resolvedById: uuid("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("reports_status_idx").on(t.status)]);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  seekerId: uuid("seeker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  body: text("body"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("reviews_unique").on(t.companyId, t.seekerId)]);

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  meta: text("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("activity_logs_user_idx").on(t.userId, t.createdAt)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  meta: text("meta"),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("audit_logs_created_idx").on(t.createdAt)]);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
});

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  template: text("template").notNull(),
  body: text("body").notNull(),
  status: emailStatusEnum("status").notNull().default("logged"),
  meta: text("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("email_logs_created_idx").on(t.createdAt)]);

/* ---------------------------------- Types ----------------------------------- */

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobCategory = typeof jobCategories.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type PlanEntitlement = typeof planEntitlements.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type VideoCv = typeof videoCvs.$inferSelect;
export type JobSeekerProfile = typeof jobSeekerProfiles.$inferSelect;
export type EmployerProfile = typeof employerProfiles.$inferSelect;
export type ResponseMetrics = typeof responseMetrics.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Skill = typeof skills.$inferSelect;
