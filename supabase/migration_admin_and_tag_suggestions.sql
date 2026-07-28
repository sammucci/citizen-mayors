-- Admin flag: gates admin-only features (like approving tag
-- suggestions) behind the same login everyone already has, instead of
-- a separate password system.
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Flips Samantha's existing account to admin. Matches by auth email
-- since profiles doesn't store one — update the email below if this is
-- ever run for a different account.
update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id and u.email = 'samantha@weareombuds.com';

-- Tag suggestions: anyone signed in can propose a new tag on a
-- proposal. It sits pending until an admin approves it (which creates
-- the real row in the shared `tags` table and attaches it to the
-- proposal that prompted it) or rejects it. Same review-queue shape as
-- the existing "suggested edit" flow on comments, just for tags.
create table public.tag_suggestions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  suggested_by uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.tag_suggestions enable row level security;

create policy "public read tag_suggestions" on public.tag_suggestions for select using (true);

create policy "authenticated create tag_suggestions" on public.tag_suggestions for insert
  with check (auth.uid() = suggested_by);

create policy "admin updates tag_suggestions" on public.tag_suggestions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Approving a suggestion needs to insert a brand-new row into the
-- shared tags table (previously nothing but the initial seed data could
-- do that) — restricted to admins only, same as the review action above.
create policy "admin inserts tags" on public.tags for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
