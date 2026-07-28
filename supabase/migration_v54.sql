-- v54: housing status demographic, public civic bio, volunteer-category
-- registry, publish/unpublish for proposals (replacing an earlier plan
-- to allow hard-deleting them), and an admin block flag for members.
-- Safe to re-run (every add-column/create-table/create-policy below is
-- idempotent or conflict-checked).

-- ---------------------------------------------------------------------------
-- Profiles: housing status (aggregate-only demographic, same treatment as
-- age/race/gender — optional, never required, never shown on a public
-- profile), a short civic bio (the one field that IS shown publicly),
-- and an admin-only block flag (see below).
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists housing_status text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists is_blocked boolean not null default false;
-- Powers the "what's new since you were last here" banner on /profile
-- (new comments/replies on your stuff, unresolved suggested edits) —
-- existing rows all get set to the moment this migration runs (so
-- nobody's flooded with their entire history as "new"), new signups
-- get their actual signup time via the same default.
alter table public.profiles add column if not exists notifications_seen_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Volunteer categories: shared, crowdsourced registry (like decision_makers
-- and tags) so "hours by category" reporting doesn't fracture across
-- "Environment" / "environment" / "enviro" as separate free-text values.
-- ---------------------------------------------------------------------------
create table if not exists public.volunteer_categories (
  id serial primary key,
  label text unique not null,
  created_at timestamptz not null default now()
);
alter table public.volunteer_categories enable row level security;

drop policy if exists "public read volunteer categories" on public.volunteer_categories;
create policy "public read volunteer categories" on public.volunteer_categories for select using (true);

drop policy if exists "authenticated add volunteer categories" on public.volunteer_categories;
create policy "authenticated add volunteer categories" on public.volunteer_categories for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "admin updates volunteer categories" on public.volunteer_categories;
create policy "admin updates volunteer categories" on public.volunteer_categories for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "admin deletes volunteer categories" on public.volunteer_categories;
create policy "admin deletes volunteer categories" on public.volunteer_categories for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- ---------------------------------------------------------------------------
-- Proposals: reversible publish/unpublish instead of hard delete — the
-- owner can take a proposal down from public view (comments, decision
-- chain, and votes all stay intact underneath) and bring it back later.
-- Also doubles as a draft mode: a brand-new proposal can be saved
-- unpublished from the start, worked on with the normal edit tools
-- privately, and published when ready.
-- ---------------------------------------------------------------------------
alter table public.proposals add column if not exists published boolean not null default true;

drop policy if exists "public read proposals" on public.proposals;
drop policy if exists "public read published proposals" on public.proposals;
create policy "public read published proposals" on public.proposals for select
  using (published or auth.uid() = owner_id);

-- The owner can still delete their own proposal outright if they really
-- want to (the UI now defaults to the reversible unpublish toggle
-- instead, but this policy stays available). Every child table already
-- has "on delete cascade" back to proposals.
drop policy if exists "owner deletes own proposal" on public.proposals;
create policy "owner deletes own proposal" on public.proposals for delete
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Admin: block a member. Blocking only stops NEW writes (comments,
-- proposals, votes, decision-tree contributions all check this in the
-- app layer) — it deliberately does not retroactively hide or delete
-- anything they already posted, matching the "reversible, not
-- destructive" approach used for proposals above. An admin can unblock
-- just as easily.
-- ---------------------------------------------------------------------------
drop policy if exists "admin blocks members" on public.profiles;
create policy "admin blocks members" on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
