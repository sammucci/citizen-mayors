-- Run this in the Supabase SQL Editor if you already ran the original
-- schema.sql once. It's safe to run even if some of these already exist —
-- everything here is written to not error out on a second run.
--
-- Do NOT re-paste the full schema.sql on top of an already-set-up project —
-- it would fail on the category/tag seed rows already being there and could
-- stop partway through.

alter table public.proposals add column if not exists council_district int;

alter table public.proposals drop constraint if exists proposals_council_district_check;
alter table public.proposals add constraint proposals_council_district_check
  check (council_district between 1 and 10);

alter table public.profiles add column if not exists council_district int;

create table if not exists public.zip_council_districts (
  zip_code text not null,
  council_district int not null,
  primary key (zip_code, council_district)
);

alter table public.zip_council_districts enable row level security;

drop policy if exists "public read zip council districts" on public.zip_council_districts;
create policy "public read zip council districts" on public.zip_council_districts
  for select using (true);
