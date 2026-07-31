-- Organization / civic-group crowdsourced profiles — v1.
-- Run this script. Safe to run more than once (every create is guarded).

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists organizations_name_idx on public.organizations (lower(name));

create table if not exists public.organization_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  area_represented text,
  topics text[] not null default '{}',
  description text not null default '',
  meets_when text,
  meets_where text,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  edited_by uuid references public.profiles(id),
  edited_at timestamptz not null default now()
);

create table if not exists public.profile_organizations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, organization_id)
);

alter table public.organizations enable row level security;
alter table public.organization_profiles enable row level security;
alter table public.organization_revisions enable row level security;
alter table public.profile_organizations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'organizations' and policyname = 'public read organizations') then
    create policy "public read organizations" on public.organizations for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'organizations' and policyname = 'authenticated add organizations') then
    create policy "authenticated add organizations" on public.organizations for insert
      with check (auth.uid() = added_by);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'organizations' and policyname = 'admin updates organizations') then
    create policy "admin updates organizations" on public.organizations for update
      using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'organizations' and policyname = 'admin deletes organizations') then
    create policy "admin deletes organizations" on public.organizations for delete
      using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'organization_profiles' and policyname = 'public read organization profiles') then
    create policy "public read organization profiles" on public.organization_profiles
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'organization_profiles' and policyname = 'authenticated insert organization profiles') then
    create policy "authenticated insert organization profiles" on public.organization_profiles
      for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'organization_profiles' and policyname = 'authenticated update organization profiles') then
    create policy "authenticated update organization profiles" on public.organization_profiles
      for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'organization_profiles' and policyname = 'admin deletes organization profiles') then
    create policy "admin deletes organization profiles" on public.organization_profiles
      for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'organization_revisions' and policyname = 'public read organization revisions') then
    create policy "public read organization revisions" on public.organization_revisions
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'organization_revisions' and policyname = 'authenticated add organization revisions') then
    create policy "authenticated add organization revisions" on public.organization_revisions
      for insert to authenticated with check (auth.uid() = edited_by);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'organization_revisions' and policyname = 'admin deletes organization revisions') then
    create policy "admin deletes organization revisions" on public.organization_revisions
      for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'profile_organizations' and policyname = 'public read profile organizations') then
    create policy "public read profile organizations" on public.profile_organizations
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profile_organizations' and policyname = 'members attach their own organizations') then
    create policy "members attach their own organizations" on public.profile_organizations
      for insert to authenticated with check (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profile_organizations' and policyname = 'members remove their own organizations') then
    create policy "members remove their own organizations" on public.profile_organizations
      for delete to authenticated using (auth.uid() = profile_id);
  end if;
end $$;
