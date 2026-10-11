create extension if not exists "pgcrypto";

create table psychologists (
  id uuid primary key references auth.users(id),
  full_name text not null,
  license_number text not null,
  license_document_url text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),

  nickname text,
  avatar_url text,
  education text,
  specialization text,
  price_per_session numeric,
  is_on_call boolean not null default false,
  created_at timestamptz not null default now()
);

create table patients (
  id uuid primary key references auth.users(id),
  archetype_id text not null check (archetype_id in ('guardian', 'healer', 'scholar', 'companion')),
  tier text not null default 'low' check (tier in ('low', 'medium', 'high')),
  assigned_psychologist_id uuid references psychologists(id),
  total_points int not null default 0,
  data_sharing_consent boolean not null default false,
  consent_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table screening_scores (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  instrument text not null default 'custom' check (instrument in ('gad7', 'phq9', 'custom')),
  total_score numeric not null,
  raw_answers jsonb,
  created_at timestamptz not null default now()
);

create table chat_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  expression text check (expression in ('netral', 'senang', 'khawatir')),
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create table sentiment_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  date date not null,
  stabil_score numeric not null check (stabil_score >= 0 and stabil_score <= 100),
  cemas_score numeric not null check (cemas_score >= 0 and cemas_score <= 100),
  created_at timestamptz not null default now(),
  unique (patient_id, date)
);

create table crisis_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  chat_log_id uuid not null references chat_logs(id),
  status text not null default 'pending'
    check (status in ('pending', 'acknowledged', 'escalated', 'resolved')),
  acknowledged_by uuid references psychologists(id),
  created_at timestamptz not null default now()
);

create table quests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  category text not null
    check (category in ('indoor_ringan', 'outdoor_ringan', 'outdoor_sedang', 'sosial')),
  title text not null,
  points int not null default 10,
  status text not null default 'active' check (status in ('active', 'completed', 'skipped')),
  route_data jsonb,
  social_report text,
  feeling_input text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  psychologist_id uuid not null references psychologists(id),
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_method text check (payment_method in ('transfer', 'qris', 'points_redeem')),
  price numeric,
  created_at timestamptz not null default now()
);

alter table patients enable row level security;
alter table psychologists enable row level security;
alter table screening_scores enable row level security;
alter table chat_logs enable row level security;
alter table sentiment_logs enable row level security;
alter table crisis_alerts enable row level security;

create policy "patients_select_own" on patients for select using (auth.uid() = id);
create policy "patients_update_own" on patients for update using (auth.uid() = id);
create policy "patients_insert_own" on patients for insert with check (auth.uid() = id);
create policy "patients_select_by_assigned_psychologist" on patients
  for select using (auth.uid() = assigned_psychologist_id);


create policy "psychologists_select_own" on psychologists for select using (auth.uid() = id);
create policy "psychologists_update_own" on psychologists for update using (auth.uid() = id);
create policy "psychologists_insert_own" on psychologists for insert with check (auth.uid() = id);
create policy "psychologists_select_verified_public" on psychologists
  for select using (verification_status = 'verified');


create policy "screening_scores_all_own_patient" on screening_scores
  for all using (
    auth.uid() = patient_id
    or auth.uid() in (select assigned_psychologist_id from patients where id = screening_scores.patient_id)
  );


create policy "chat_logs_all_own_patient" on chat_logs
  for all using (
    auth.uid() = patient_id
    or auth.uid() in (select assigned_psychologist_id from patients where id = chat_logs.patient_id)
  );

create policy "sentiment_logs_select" on sentiment_logs
  for select using (
    auth.uid() = patient_id
    or auth.uid() in (select assigned_psychologist_id from patients where id = sentiment_logs.patient_id)
  );

create policy "quests_all_own_patient" on quests
  for all using (
    auth.uid() = patient_id
    or auth.uid() in (select assigned_psychologist_id from patients where id = quests.patient_id)
  );


create policy "crisis_alerts_select_on_call" on crisis_alerts
  for select using (
    auth.uid() in (select id from psychologists where is_on_call = true)
    or auth.uid() = patient_id
  );
create policy "crisis_alerts_update_on_call" on crisis_alerts
  for update using (auth.uid() in (select id from psychologists where is_on_call = true));

create policy "bookings_all_involved" on bookings
  for all using (auth.uid() = patient_id or auth.uid() = psychologist_id);