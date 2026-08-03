-- Two features, one migration:
--
-- 1. Photo/logo upload for decision-maker & organization profiles.
--    Same "server action + FormData + Storage bucket" pattern already
--    used for proposal cover images (proposal-images bucket) and profile
--    avatars (avatars bucket) — see migration_profile_avatars.sql. No
--    focal-point repositioning like proposal covers get (that exists
--    because a wide banner crop genuinely needs one); these are simple
--    circular/square photos, same treatment as the avatar.
--    Columns go on the `_profiles` tables (not the base decision_makers/
--    organizations registry tables) — same reasoning as where
--    image_position_x/y live for proposals: this is profile CONTENT,
--    wiki-edited by any signed-in user, not part of the admin-only
--    shared registry row itself.
--
-- 2. "Issue tags" on decision-maker profiles — reuses the exact same
--    `tags` registry proposals already tag themselves with (Housing,
--    Streets & Safety, ...), so tagging a decision-maker as active on
--    "Housing" means the same thing everywhere on the site, not a
--    second parallel vocabulary. Deliberately EXISTING-TAG-ONLY, no
--    "suggest a brand-new tag" flow here — decision_makers have no
--    owner concept (unlike a proposal), so the existing two-stage
--    owner-then-admin approval model for minting a genuinely new tag
--    (see tag_suggestions/suggestTag) has no first-tier approver to
--    reuse here. A brand-new topic tag gets created the normal way (on
--    a proposal, or by an admin), then becomes attachable here like any
--    other. Attaching an EXISTING tag needs no approval at all — same
--    "informational lead, not a claim on anyone's behalf" reasoning as
--    proposal_grants (see schema.sql), not the same trust bar as a
--    decision-chain node claiming a specific person's real support.

alter table public.decision_maker_profiles
  add column if not exists photo_url text;

alter table public.organization_profiles
  add column if not exists logo_url text;

-- Same shape as proposal_tags, just keyed to decision_makers instead of
-- proposals. added_by is what lets "remove" be scoped to "whoever
-- attached it, or an admin" (see decision_maker_legislation's delete
-- policy for the identical shape) instead of open to anyone.
create table if not exists public.decision_maker_tags (
  decision_maker_id uuid not null references public.decision_makers(id) on delete cascade,
  tag_id int not null references public.tags(id) on delete cascade,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (decision_maker_id, tag_id)
);

alter table public.decision_maker_tags enable row level security;

drop policy if exists "public read decision maker tags" on public.decision_maker_tags;
drop policy if exists "authenticated add decision maker tags" on public.decision_maker_tags;
drop policy if exists "adder or admin removes decision maker tags" on public.decision_maker_tags;

create policy "public read decision maker tags" on public.decision_maker_tags
  for select using (true);
-- No approval step, on purpose (see the comment up top) — any signed-in
-- user can attach an EXISTING tag straight away. Creating a brand-new
-- tag still goes through the existing admin-only "tags" insert policy;
-- this table only ever links to tags that already exist.
create policy "authenticated add decision maker tags" on public.decision_maker_tags
  for insert to authenticated with check (auth.uid() = added_by);
create policy "adder or admin removes decision maker tags" on public.decision_maker_tags
  for delete using (
    auth.uid() = added_by
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Storage: decision-maker photos + organization logos. Same
-- public-read / authenticated-insert / authenticated-update policy
-- shape as the avatars bucket (migration_profile_avatars.sql) — no
-- per-row ownership check on storage itself (the wiki-editing model
-- means anyone signed in can replace either), matching how every other
-- field on these two profiles already works.
insert into storage.buckets (id, name, public)
values ('decision-maker-photos', 'decision-maker-photos', true)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('organization-logos', 'organization-logos', true)
on conflict (id) do nothing;

drop policy if exists "public read decision maker photos" on storage.objects;
drop policy if exists "authenticated upload decision maker photos" on storage.objects;
drop policy if exists "authenticated update decision maker photos" on storage.objects;
drop policy if exists "public read organization logos" on storage.objects;
drop policy if exists "authenticated upload organization logos" on storage.objects;
drop policy if exists "authenticated update organization logos" on storage.objects;

create policy "public read decision maker photos" on storage.objects for select
  using (bucket_id = 'decision-maker-photos');
create policy "authenticated upload decision maker photos" on storage.objects for insert
  with check (bucket_id = 'decision-maker-photos' and auth.role() = 'authenticated');
create policy "authenticated update decision maker photos" on storage.objects for update
  using (bucket_id = 'decision-maker-photos' and auth.role() = 'authenticated');

create policy "public read organization logos" on storage.objects for select
  using (bucket_id = 'organization-logos');
create policy "authenticated upload organization logos" on storage.objects for insert
  with check (bucket_id = 'organization-logos' and auth.role() = 'authenticated');
create policy "authenticated update organization logos" on storage.objects for update
  using (bucket_id = 'organization-logos' and auth.role() = 'authenticated');
