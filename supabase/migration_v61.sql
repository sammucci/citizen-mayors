-- v61: categories for project tags (tag_groups), so tags like "bike
-- lanes" / "bike safety" / "pedestrians" can roll up into one curated
-- topic ("Pedestrian & Bike Safety") on the admin page and the
-- community dashboard, instead of staying dozens of unrelated tags.
-- Same shape as volunteer_category_groups/volunteer_categories, just
-- for the tags table instead. Safe to re-run.

create table if not exists public.tag_groups (
  id serial primary key,
  label text unique not null,
  created_at timestamptz not null default now()
);

alter table public.tags add column if not exists group_id int references public.tag_groups(id) on delete set null;

alter table public.tag_groups enable row level security;

drop policy if exists "public read tag groups" on public.tag_groups;
create policy "public read tag groups" on public.tag_groups for select using (true);

drop policy if exists "admin add tag groups" on public.tag_groups;
create policy "admin add tag groups" on public.tag_groups for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "admin updates tag groups" on public.tag_groups;
create policy "admin updates tag groups" on public.tag_groups for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "admin deletes tag groups" on public.tag_groups;
create policy "admin deletes tag groups" on public.tag_groups for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
