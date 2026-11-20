-- ConnectFlow AI – core schema (all tables prefixed cf_ to stay separate from other apps)
-- Every business-related record carries business_id. Composite foreign keys make it
-- impossible for a list, call, note or message to point at a lead from the other business.

create extension if not exists pgcrypto;

-- ---------- Businesses & membership ----------
create table public.cf_businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  created_at timestamptz not null default now()
);

create table public.cf_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.cf_business_members (
  business_id uuid not null references public.cf_businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.cf_business_settings (
  business_id uuid primary key references public.cf_businesses(id) on delete cascade,
  services jsonb not null default '[]'::jsonb,        -- programs / coaching services
  target_audience text,
  description text,
  location text,
  process text,                                        -- consultation / admission process
  age_groups text,
  learning_methods text,
  verified_pricing jsonb not null default '[]'::jsonb, -- [{item, amount_inr, notes}]
  faqs jsonb not null default '[]'::jsonb,             -- [{q, a}]
  goals text,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Membership helper (used by every RLS policy) ----------
create or replace function public.cf_is_member(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cf_business_members m
                 where m.business_id = bid and m.user_id = auth.uid());
$$;

-- First person to sign in becomes owner of both businesses. After that, nobody else
-- can claim them (new users see an "ask the owner for access" screen).
create or replace function public.cf_claim_workspaces()
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'not_signed_in'; end if;
  if exists (select 1 from cf_business_members where user_id = auth.uid()) then return 'already_member'; end if;
  if exists (select 1 from cf_business_members) then return 'owner_exists'; end if;
  insert into cf_business_members (business_id, user_id, role)
    select id, auth.uid(), 'owner' from cf_businesses;
  insert into cf_profiles (id) values (auth.uid()) on conflict do nothing;
  return 'claimed';
end $$;

-- ---------- Leads ----------
create table public.cf_lead_sources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cf_businesses(id) on delete cascade,
  name text not null,
  source_type text not null default 'manual', -- manual, referral, enquiry_form, search_api, event...
  url text,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.cf_leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cf_businesses(id) on delete cascade,
  name text,
  phone text,
  email text,
  location text,
  category text,
  requirement text,
  source text,
  source_link text,
  discovered_at timestamptz,
  permission_status text not null default 'unknown'
    check (permission_status in ('unknown','pending','opted_in','opted_out')),
  message_status text not null default 'not_sent'
    check (message_status in ('not_sent','sent','replied','follow_up')),
  lead_status text not null default 'new'
    check (lead_status in ('new','contacted','interested','requested_info','call_booked','follow_up','not_interested','converted')),
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create unique index cf_leads_phone_unique on public.cf_leads (business_id, phone) where phone is not null and phone <> '';
create index cf_leads_business_idx on public.cf_leads (business_id, created_at desc);

create table public.cf_contact_permissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  lead_id uuid not null,
  status text not null check (status in ('unknown','pending','opted_in','opted_out')),
  method text,      -- e.g. "enquiry form", "replied YES on WhatsApp", "verbal on call"
  evidence text,
  recorded_by uuid references auth.users(id) default auth.uid(),
  recorded_at timestamptz not null default now(),
  foreign key (lead_id, business_id) references public.cf_leads(id, business_id) on delete cascade
);

-- ---------- Lists ----------
create table public.cf_lists (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cf_businesses(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (business_id, name),
  unique (id, business_id)
);

create table public.cf_list_members (
  list_id uuid not null,
  lead_id uuid not null,
  business_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (list_id, lead_id),
  -- deleting a list removes only memberships, never the lead
  foreign key (list_id, business_id) references public.cf_lists(id, business_id) on delete cascade,
  foreign key (lead_id, business_id) references public.cf_leads(id, business_id) on delete cascade
);

-- ---------- Messaging ----------
create table public.cf_message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cf_businesses(id) on delete cascade,
  name text not null,
  purpose text,
  body text not null,
  wa_template_name text,      -- name of Meta-approved template, if any
  wa_language text default 'en',
  wa_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.cf_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  lead_id uuid not null,
  direction text not null check (direction in ('outbound','inbound')),
  body text,
  template_id uuid references public.cf_message_templates(id) on delete set null,
  wa_message_id text unique,
  status text not null default 'draft'
    check (status in ('draft','queued','sent','delivered','read','failed','received')),
  error text,
  sent_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (lead_id, business_id) references public.cf_leads(id, business_id) on delete cascade
);
create index cf_messages_lead_idx on public.cf_messages (lead_id, created_at);

create table public.cf_incoming_replies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  lead_id uuid not null,
  message_id uuid references public.cf_messages(id) on delete set null,
  wa_from text,
  body text,
  raw jsonb,
  received_at timestamptz not null default now(),
  foreign key (lead_id, business_id) references public.cf_leads(id, business_id) on delete cascade
);

-- ---------- Calls, notes, follow-ups ----------
create table public.cf_call_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  lead_id uuid not null,
  called_at timestamptz not null,
  discussion_notes text,
  outcome text not null check (outcome in ('interested','requested_info','one_to_one_agreed','follow_up_required','not_interested','no_answer')),
  interest_level text check (interest_level in ('high','medium','low','none')),
  agreed_one_to_one boolean not null default false,
  next_follow_up date,
  additional_notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (lead_id, business_id) references public.cf_leads(id, business_id) on delete cascade
);
create index cf_calls_lead_idx on public.cf_call_history (lead_id, called_at desc);

create table public.cf_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  lead_id uuid not null,
  body text not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (lead_id, business_id) references public.cf_leads(id, business_id) on delete cascade
);

create table public.cf_follow_ups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  lead_id uuid not null,
  due_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','done','cancelled')),
  source_call_id uuid references public.cf_call_history(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (lead_id, business_id) references public.cf_leads(id, business_id) on delete cascade
);

-- ---------- 7-day planner ----------
create table public.cf_weekly_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cf_businesses(id) on delete cascade,
  week_start date not null,
  title text,
  summary text,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.cf_daily_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  plan_id uuid not null,
  day_number int not null check (day_number between 1 and 7),
  task_date date,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  completed_at timestamptz,
  sort_order int not null default 0,
  foreign key (plan_id, business_id) references public.cf_weekly_plans(id, business_id) on delete cascade
);

-- ---------- Activity log ----------
create table public.cf_activity_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.cf_businesses(id) on delete cascade,
  actor uuid default auth.uid(),
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index cf_activity_business_idx on public.cf_activity_logs (business_id, created_at desc);

-- ---------- Seed the two businesses ----------
insert into public.cf_businesses (slug, name, tagline) values
  ('health-coaching', 'Health Coaching', 'Weight management, nutrition & healthy lifestyle coaching'),
  ('ratnagiri-gurukula', 'Ratnagiri Gurukula', 'Bhagavad Gita, value-based education & emotional development for children');
insert into public.cf_business_settings (business_id) select id from public.cf_businesses;
