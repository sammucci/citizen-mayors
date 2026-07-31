-- Decision-maker (elected official) crowdsourced profiles — v1.
-- Run this script. Safe to run more than once (every create is guarded).

create table if not exists public.decision_maker_profiles (
  decision_maker_id uuid primary key references public.decision_makers(id) on delete cascade,
  office_title text,
  elected_date date,
  term_end_date date,
  next_election_date date,
  represents_scope text not null default 'n/a'
    check (represents_scope in ('district', 'citywide', 'n/a')),
  represents_district int,
  committees text[] not null default '{}',
  party_affiliation text,
  how_they_show_up text not null default '',
  what_they_care_about text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.decision_maker_legislation (
  id uuid primary key default gen_random_uuid(),
  decision_maker_id uuid not null references public.decision_makers(id) on delete cascade,
  title text not null,
  stance text not null check (stance in ('introduced', 'for', 'against')),
  note text,
  occurred_on date,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.decision_maker_revisions (
  id uuid primary key default gen_random_uuid(),
  decision_maker_id uuid not null references public.decision_makers(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  edited_by uuid references public.profiles(id),
  edited_at timestamptz not null default now()
);

alter table public.decision_maker_profiles enable row level security;
alter table public.decision_maker_legislation enable row level security;
alter table public.decision_maker_revisions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'decision_maker_profiles' and policyname = 'public read decision maker profiles') then
    create policy "public read decision maker profiles" on public.decision_maker_profiles
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'decision_maker_profiles' and policyname = 'authenticated insert decision maker profiles') then
    create policy "authenticated insert decision maker profiles" on public.decision_maker_profiles
      for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'decision_maker_profiles' and policyname = 'authenticated update decision maker profiles') then
    create policy "authenticated update decision maker profiles" on public.decision_maker_profiles
      for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'decision_maker_profiles' and policyname = 'admin deletes decision maker profiles') then
    create policy "admin deletes decision maker profiles" on public.decision_maker_profiles
      for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'decision_maker_legislation' and policyname = 'public read decision maker legislation') then
    create policy "public read decision maker legislation" on public.decision_maker_legislation
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'decision_maker_legislation' and policyname = 'authenticated add decision maker legislation') then
    create policy "authenticated add decision maker legislation" on public.decision_maker_legislation
      for insert to authenticated with check (auth.uid() = added_by);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'decision_maker_legislation' and policyname = 'authenticated update decision maker legislation') then
    create policy "authenticated update decision maker legislation" on public.decision_maker_legislation
      for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'decision_maker_legislation' and policyname = 'admin deletes decision maker legislation') then
    create policy "admin deletes decision maker legislation" on public.decision_maker_legislation
      for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'decision_maker_revisions' and policyname = 'public read decision maker revisions') then
    create policy "public read decision maker revisions" on public.decision_maker_revisions
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'decision_maker_revisions' and policyname = 'authenticated add decision maker revisions') then
    create policy "authenticated add decision maker revisions" on public.decision_maker_revisions
      for insert to authenticated with check (auth.uid() = edited_by);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'decision_maker_revisions' and policyname = 'admin deletes decision maker revisions') then
    create policy "admin deletes decision maker revisions" on public.decision_maker_revisions
      for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
  end if;
end $$;
