-- v56: volunteer category groups (curated, admin-managed) + first-pass
-- seed data from Samantha's list; decision-chain node updated_at (needed
-- so notifications can tell "your suggestion was approved" apart from
-- "you just added this"). Safe to re-run.

create table if not exists public.volunteer_category_groups (
  id serial primary key,
  label text unique not null,
  created_at timestamptz not null default now()
);

alter table public.volunteer_categories
  add column if not exists group_id int references public.volunteer_category_groups(id) on delete set null;

alter table public.proposal_power_tree_nodes
  add column if not exists updated_at timestamptz not null default now();

-- Lets an admin category rename bulk-update the plain-text `category`
-- column on every affected civic_logs row, regardless of who logged it.
drop policy if exists "admin updates any civic log" on public.civic_logs;
create policy "admin updates any civic log" on public.civic_logs for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

alter table public.volunteer_category_groups enable row level security;

drop policy if exists "public read volunteer category groups" on public.volunteer_category_groups;
create policy "public read volunteer category groups" on public.volunteer_category_groups for select using (true);

drop policy if exists "admin add volunteer category groups" on public.volunteer_category_groups;
create policy "admin add volunteer category groups" on public.volunteer_category_groups for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "admin updates volunteer category groups" on public.volunteer_category_groups;
create policy "admin updates volunteer category groups" on public.volunteer_category_groups for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists "admin deletes volunteer category groups" on public.volunteer_category_groups;
create policy "admin deletes volunteer category groups" on public.volunteer_category_groups for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Samantha's first-pass groups. She can add/rename/delete more on the
-- admin page — this just seeds the starting set so it's not empty.
insert into public.volunteer_category_groups (label) values
  ('Environmental'),
  ('Animals'),
  ('Social Impact'),
  ('Health & Wellness'),
  ('Sports & Leisure'),
  ('Civic & Government')
on conflict (label) do nothing;

-- Seed tags under their groups (upsert: if a tag with this exact label
-- already exists from someone typing it while logging hours, this just
-- assigns it to the right group instead of creating a duplicate).
insert into public.volunteer_categories (label, group_id)
select v.tag_label, g.id
from (values
  ('Permaculture', 'Environmental'),
  ('Farming', 'Environmental'),
  ('Ecovillages', 'Environmental'),
  ('Environmental Conservation', 'Environmental'),
  ('Animal Farms', 'Animals'),
  ('Wildlife Conservation', 'Animals'),
  ('Animal Rescue', 'Animals'),
  ('Animal Care', 'Animals'),
  ('Children & Youth', 'Social Impact'),
  ('Senior Citizens', 'Social Impact'),
  ('Education & Teaching', 'Social Impact'),
  ('Community Development', 'Social Impact'),
  ('Women''s Empowerment', 'Social Impact'),
  ('Homeless Services', 'Social Impact'),
  ('Holistic Centers', 'Health & Wellness'),
  ('Playgrounds', 'Health & Wellness'),
  ('Tourism', 'Sports & Leisure'),
  ('Sporting Events', 'Sports & Leisure')
) as v(tag_label, group_label)
join public.volunteer_category_groups g on g.label = v.group_label
on conflict (label) do update set group_id = excluded.group_id;
