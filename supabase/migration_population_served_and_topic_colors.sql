-- Two independent changes bundled together this version:
--   1) Splits volunteer-hours logging into "what you did" (existing
--      category field, unchanged) and a new, separate "who it was for"
--      field — see population_categories' comment below for why.
--   2) Gives each project-tag topic (tag_groups) its own color, so
--      "Proposals by topic" on the community dashboard can color-code
--      each bar instead of every one of them being the same flat purple.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Part 1: population served
-- ---------------------------------------------------------------------------
alter table public.civic_logs add column if not exists population_served text;

-- "What you did" (volunteer_categories) and "who it was for" used to be
-- forced into the same single field — tutoring someone's kids and
-- tutoring an ESL class for seniors had no way to both be "Tutoring,"
-- since picking a population-flavored category instead of the activity
-- meant losing the activity, and vice versa. This is the second,
-- independent, optional field. Deliberately NOT "grows as you type" like
-- volunteer_categories — the whole point of splitting this out is to
-- stop taxonomy sprawl, so this stays small and admin-only.
create table if not exists public.population_categories (
  id serial primary key,
  label text unique not null,
  created_at timestamptz not null default now()
);

alter table public.population_categories enable row level security;

drop policy if exists "public read population categories" on public.population_categories;
create policy "public read population categories" on public.population_categories for select using (true);
drop policy if exists "admin add population categories" on public.population_categories;
create policy "admin add population categories" on public.population_categories for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
drop policy if exists "admin updates population categories" on public.population_categories;
create policy "admin updates population categories" on public.population_categories for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
drop policy if exists "admin deletes population categories" on public.population_categories;
create policy "admin deletes population categories" on public.population_categories for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Starting list — small and deliberate, edit anytime on the admin tags
-- page, same as every other curated list in this app.
insert into public.population_categories (label)
select v.label from (values
  ('Children'), ('Youth'), ('Seniors'), ('Immigrants & Refugees'),
  ('People experiencing homelessness'), ('Women'), ('General public / everyone')
) as v(label)
where not exists (select 1 from public.population_categories where label = v.label);

-- Data cleanup: "Children & Youth" and "Senior Citizens" were sitting in
-- the activity list (volunteer_categories) purely because there was
-- nowhere else to put a population — moving any past log entries that
-- used them over to the new field, then removing them as activities so
-- they don't keep showing up as something you supposedly "did."
update public.civic_logs
set population_served = 'Youth', category = null
where lower(trim(category)) = lower('Children & Youth');

update public.civic_logs
set population_served = 'Seniors', category = null
where lower(trim(category)) = lower('Senior Citizens');

delete from public.volunteer_categories where label in ('Children & Youth', 'Senior Citizens');

-- ---------------------------------------------------------------------------
-- Part 2: topic colors
-- ---------------------------------------------------------------------------
alter table public.tag_groups add column if not exists color text;

-- Starting colors for the topics from this session's tag-group reorg —
-- distinct from the 7 category colors so the two systems (proposal
-- category vs. tag topic) don't visually blur together. Any OTHER
-- existing topic not listed here (e.g. ones created earlier and not
-- touched this session) is left with no color and falls back to a
-- neutral grey bar until set on the admin page.
update public.tag_groups set color = '#C2703D' where label = 'Housing' and color is null;
update public.tag_groups set color = '#3B82A0' where label = 'Streets & Safety' and color is null;
update public.tag_groups set color = '#4CAF7D' where label = 'Health & Community' and color is null;
update public.tag_groups set color = '#E0A83E' where label = 'Mobility & Transit' and color is null;
