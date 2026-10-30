-- Supabase Row Level Security policies (enable after deploying to Supabase).
-- The app enforces these same rules server-side, so they are defense-in-depth.
--
-- On Supabase:
--   1. Run your table migrations (drizzle-kit push or SQL).
--   2. Run this file in the SQL editor.
--   3. Map auth.uid() to your users table via a trigger or a `auth_user_id` column.
--
-- IMPORTANT: Next.js server actions connect with the service role only from
-- trusted server code; expose only the anon key to browsers.

alter table users enable row level security;
alter table job_seeker_profiles enable row level security;
alter table employer_profiles enable row level security;
alter table companies enable row level security;
alter table jobs enable row level security;
alter table applications enable row level security;
alter table resumes enable row level security;
alter table video_cvs enable row level security;
alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table membership_plans enable row level security;
alter table reports enable row level security;

-- Jobs: anyone can read active posts; owners manage their own
create policy "jobs_public_read" on jobs for select using (status = 'active');
create policy "jobs_owner_all" on jobs for all using (employer_id = auth.uid());

-- Applications: seeker owns theirs; employer reads applications to their jobs
create policy "app_seeker_read" on applications for select using (seeker_id = auth.uid());
create policy "app_seeker_insert" on applications for insert with check (seeker_id = auth.uid());
create policy "app_employer_read" on applications for select
  using (exists (select 1 from jobs j where j.id = applications.job_id and j.employer_id = auth.uid()));
create policy "app_employer_update" on applications for update
  using (exists (select 1 from jobs j where j.id = applications.job_id and j.employer_id = auth.uid()));

-- Messaging: participants only
create policy "conv_participant" on conversations for select
  using (exists (select 1 from conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid()));
create policy "msg_participant" on messages for select
  using (exists (select 1 from conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()));
create policy "msg_participant_insert" on messages for insert
  with check (sender_id = auth.uid() and exists (
    select 1 from conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()));

-- Notifications are personal
create policy "notif_owner" on notifications for all using (user_id = auth.uid());

-- Files: owner only (resumes/video CVs are served via signed URLs anyway)
create policy "resume_owner" on resumes for all using (
  seeker_id = (select id from job_seeker_profiles where user_id = auth.uid()));
create policy "video_owner" on video_cvs for all using (
  seeker_id = (select id from job_seeker_profiles where user_id = auth.uid()));

-- Plans are readable by everyone; only write via service role
create policy "plans_read" on membership_plans for select using (is_active = true);

-- Subscriptions & payments are user-readable, service-role writable
create policy "sub_owner_read" on subscriptions for select using (user_id = auth.uid());
create policy "pay_owner_read" on payments for select using (user_id = auth.uid());

-- Reports: insert by authenticated users; read by admins via service role
create policy "report_insert" on reports for insert with check (reporter_id = auth.uid());
