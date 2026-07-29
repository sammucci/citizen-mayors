-- Adds the "funding needed" flag on proposals plus a shared, crowdsourced
-- grants/funding registry (mirrors decision_makers: anyone can add to
-- the shared list, only admin can rename/remove; attaching a grant to a
-- specific proposal is open too, no approval gate — a funding lead isn't
-- a claim made on the proposal's behalf). Surfaces as a "Funding leads"
-- subsection under "Getting it done" only on proposals flagged as
-- funding_needed. Safe to re-run.

alter table public.proposals add column if not exists funding_needed boolean not null default false;

create table if not exists public.grants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  funder text,
  url text,
  description text,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index if not exists grants_name_idx on public.grants (lower(name));

create table if not exists public.proposal_grants (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  grant_id uuid not null references public.grants(id) on delete cascade,
  note text,
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (proposal_id, grant_id)
);

alter table public.grants enable row level security;
alter table public.proposal_grants enable row level security;

drop policy if exists "public read grants" on public.grants;
create policy "public read grants" on public.grants for select using (true);

drop policy if exists "public read proposal grants" on public.proposal_grants;
create policy "public read proposal grants" on public.proposal_grants for select using (true);

drop policy if exists "authenticated add grants" on public.grants;
create policy "authenticated add grants" on public.grants for insert
  with check (auth.uid() = added_by);

drop policy if exists "admin updates grants" on public.grants;
create policy "admin updates grants" on public.grants for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "admin deletes grants" on public.grants;
create policy "admin deletes grants" on public.grants for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "authenticated attach proposal grants" on public.proposal_grants;
create policy "authenticated attach proposal grants" on public.proposal_grants for insert
  with check (auth.uid() = submitted_by);

drop policy if exists "owner or admin remove proposal grants" on public.proposal_grants;
create policy "owner or admin remove proposal grants" on public.proposal_grants for delete
  using (
    exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );
