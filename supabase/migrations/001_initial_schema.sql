-- ============================================================
-- BagiRata MVP: Initial Database Schema
-- Run this in your Supabase SQL Editor or via CLI migration.
-- ============================================================

-- NOTE: Read access is capability-based via the unguessable short_code
-- and UUIDs embedded in the shareable link. This is acceptable for MVP
-- where the link itself acts as the access secret.

-- Clean up any existing partial installation to prevent "already exists" errors
drop table if exists public.assignments cascade;
drop table if exists public.items cascade;
drop table if exists public.participants cascade;
drop table if exists public.rooms cascade;
drop table if exists public.scan_jobs cascade;
drop table if exists public.gemini_calls cascade;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  short_code text unique not null,               -- unguessable 6-8 char code used in the URL
  merchant_name text,
  tax_amount integer not null default 0,
  service_charge_amount integer not null default 0,
  bank_name text,
  account_name text,
  account_number text,
  qris_path text,                                -- path in the private 'qris' storage bucket
  status text not null default 'active',         -- 'active' | 'expired'
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  quantity integer not null default 1,
  unit_price integer not null,                   -- price per single unit, IDR
  source text not null default 'scan'            -- 'scan' | 'manual'
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  unique (item_id, participant_id)               -- one participant assigned once per item
);

create table public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued',         -- 'queued' | 'processing' | 'done' | 'failed'
  result jsonb,                                  -- extracted receipt JSON when done
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gemini_calls (
  id uuid primary key default gen_random_uuid(),
  called_at timestamptz not null default now()   -- one row per Gemini call, used for rate-limit counting
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_rooms_short_code on public.rooms (short_code);
create index idx_gemini_calls_called_at on public.gemini_calls (called_at);
create index idx_participants_room_id on public.participants (room_id);
create index idx_items_room_id on public.items (room_id);
create index idx_assignments_item_id on public.assignments (item_id);
create index idx_assignments_participant_id on public.assignments (participant_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on every table
alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.items enable row level security;
alter table public.assignments enable row level security;
alter table public.scan_jobs enable row level security;
alter table public.gemini_calls enable row level security;

-- Client (anon) SELECT policies for Realtime subscriptions.
-- All writes go through server Route Handlers using the service-role key,
-- which bypasses RLS, so no client write policies are needed.
-- Read access is capability-based: knowing the short_code/UUID = access.

create policy "Allow anon read rooms"
  on public.rooms for select
  to anon, authenticated
  using (true);

create policy "Allow anon read participants"
  on public.participants for select
  to anon, authenticated
  using (true);

create policy "Allow anon read items"
  on public.items for select
  to anon, authenticated
  using (true);

create policy "Allow anon read assignments"
  on public.assignments for select
  to anon, authenticated
  using (true);

create policy "Allow anon read scan_jobs"
  on public.scan_jobs for select
  to anon, authenticated
  using (true);

-- gemini_calls: NO client policies at all (server-only table)

-- Create publication if it doesn't exist (handles fresh Supabase instances)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Add tables to the publication
alter publication supabase_realtime add table public.scan_jobs;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.assignments;
alter publication supabase_realtime add table public.participants;


-- ============================================================
-- Storage Buckets (create manually in Supabase Dashboard)
-- ============================================================
-- 1. Create a PRIVATE bucket named 'receipts'
--    (receipt photos, deleted after successful extraction)
-- 2. Create a PRIVATE bucket named 'qris'
--    (host QRIS images, shown to guests via short-lived signed URLs)
