-- ZeroClash persistent scheduling schema.
-- This migration creates dedicated app tables, enables RLS, and prevents overlapping active bookings.

create extension if not exists btree_gist;

create table if not exists public.zero_clash_equipment (
  id text primary key,
  name text not null,
  unit_id text not null,
  category text not null,
  building_id text not null,
  building_name text not null,
  status text not null default 'available' check (status in ('available', 'booked', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zero_clash_bookings (
  id text primary key,
  equipment_id text not null references public.zero_clash_equipment(id) on delete restrict,
  equipment_name text not null,
  unit_id text not null,
  category text not null,
  building_id text not null,
  building_name text not null,
  requester_name text not null,
  requester_role text not null,
  purpose text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'pending', 'in-use', 'checked-in', 'checked-out', 'cancelled', 'maintenance')),
  source text not null default 'supabase' check (source in ('demo', 'local', 'supabase')),
  qr_token text not null,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zero_clash_booking_interval_valid check (end_at > start_at),
  constraint zero_clash_no_overlapping_active_bookings exclude using gist (
    equipment_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status in ('confirmed', 'pending', 'in-use', 'checked-in', 'maintenance'))
);

create table if not exists public.zero_clash_waitlist_entries (
  id text primary key,
  equipment_id text not null references public.zero_clash_equipment(id) on delete restrict,
  equipment_name text not null,
  unit_id text not null,
  building_name text not null,
  requested_start_at timestamptz not null,
  requested_end_at timestamptz not null,
  user_name text not null,
  user_role text not null,
  urgency integer not null check (urgency between 1 and 5),
  no_show_penalty integer not null check (no_show_penalty between 0 and 10),
  priority_score integer not null check (priority_score between 0 and 100),
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'accepted', 'declined', 'expired', 'cancelled', 'booked')),
  created_at timestamptz not null default now(),
  offer_expires_at timestamptz,
  offered_start_at timestamptz,
  offered_end_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  constraint zero_clash_waitlist_interval_valid check (requested_end_at > requested_start_at)
);

create table if not exists public.zero_clash_audit_log (
  id text primary key,
  action text not null,
  target text not null,
  reason text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create or replace function public.zero_clash_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists zero_clash_equipment_touch_updated_at on public.zero_clash_equipment;
create trigger zero_clash_equipment_touch_updated_at
before update on public.zero_clash_equipment
for each row execute function public.zero_clash_touch_updated_at();

drop trigger if exists zero_clash_bookings_touch_updated_at on public.zero_clash_bookings;
create trigger zero_clash_bookings_touch_updated_at
before update on public.zero_clash_bookings
for each row execute function public.zero_clash_touch_updated_at();

drop trigger if exists zero_clash_waitlist_touch_updated_at on public.zero_clash_waitlist_entries;
create trigger zero_clash_waitlist_touch_updated_at
before update on public.zero_clash_waitlist_entries
for each row execute function public.zero_clash_touch_updated_at();

alter table public.zero_clash_equipment enable row level security;
alter table public.zero_clash_bookings enable row level security;
alter table public.zero_clash_waitlist_entries enable row level security;
alter table public.zero_clash_audit_log enable row level security;

drop policy if exists "zero clash read equipment" on public.zero_clash_equipment;
create policy "zero clash read equipment"
on public.zero_clash_equipment for select
to anon, authenticated
using (true);

drop policy if exists "zero clash manage equipment" on public.zero_clash_equipment;
create policy "zero clash manage equipment"
on public.zero_clash_equipment for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "zero clash read bookings" on public.zero_clash_bookings;
create policy "zero clash read bookings"
on public.zero_clash_bookings for select
to anon, authenticated
using (true);

drop policy if exists "zero clash manage bookings" on public.zero_clash_bookings;
create policy "zero clash manage bookings"
on public.zero_clash_bookings for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "zero clash read waitlist" on public.zero_clash_waitlist_entries;
create policy "zero clash read waitlist"
on public.zero_clash_waitlist_entries for select
to anon, authenticated
using (true);

drop policy if exists "zero clash manage waitlist" on public.zero_clash_waitlist_entries;
create policy "zero clash manage waitlist"
on public.zero_clash_waitlist_entries for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "zero clash read audit log" on public.zero_clash_audit_log;
create policy "zero clash read audit log"
on public.zero_clash_audit_log for select
to anon, authenticated
using (true);

drop policy if exists "zero clash append audit log" on public.zero_clash_audit_log;
create policy "zero clash append audit log"
on public.zero_clash_audit_log for insert
to anon, authenticated
with check (true);
