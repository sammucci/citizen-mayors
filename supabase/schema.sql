-- Citizen Mayors (working name) — v1 schema
-- Philly-only for v1, but categories/tags/power-tree modeled as DATA so a future
-- city can be added without touching application code.

create extension if not exists postgis;
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  zip_code text,
  council_district int, -- self-reported; checked for plausibility, not geocoded from an address
  age_range text, -- optional self-reported demographics, used only to gauge
  race_ethnicity text, -- how well participation reflects Philadelphia's real
  gender text, -- population and council districts. Never required.
  accepted_guidelines_at timestamptz, -- respectful-dialogue prompt acknowledgment
  is_admin boolean not null default false, -- gates admin-only screens, e.g. tag-suggestion review
  avatar_url text, -- optional profile picture, stored in the "avatars" bucket
  created_at timestamptz not null default now()
);

-- Which council districts a given zip code actually overlaps, so a
-- self-reported district can be sanity-checked (a 19122 zip claiming
-- District 1 is flatly impossible) without ever collecting a home address.
-- Populate this once from two free public datasets: Census ZCTA boundaries
-- and OpenDataPhilly's "City Council Districts" layer, intersected in
-- PostGIS. Many-to-many on purpose — some zips straddle more than one
-- district.
create table public.zip_council_districts (
  zip_code text not null,
  council_district int not null,
  primary key (zip_code, council_district)
);

-- ---------------------------------------------------------------------------
-- Reference data (editable without redeploying — categories/tags/power tree)
-- ---------------------------------------------------------------------------
create table public.categories (
  id serial primary key,
  slug text unique not null,
  label text not null,
  description text,
  requires_budget boolean not null default true, -- false for Governance & Civic Process
  sort_order int not null default 0,
  color text -- hex color for the category's visual accent bar
);

create table public.tags (
  id serial primary key,
  slug text unique not null,
  label text not null
);

-- Canonical, shared registry of decision-makers (elected officials, city
-- departments, boards/commissions) — so "City Council" isn't retyped and
-- misspelled on every proposal. Grows via an "add new" option when someone
-- can't find who they're looking for; the dropdown should autocomplete
-- against this table as the user types.
create table public.decision_makers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (
    kind in ('elected_official', 'department', 'board_commission', 'other')
  ),
  added_by uuid references public.profiles(id), -- null for the seeded starter list
  created_at timestamptz not null default now()
);
create unique index decision_makers_name_kind_idx
  on public.decision_makers (lower(name), kind);

-- ---------------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------------
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  title text not null,
  type text not null check (type in ('policy', 'project')),
  category_id int not null references public.categories(id),
  summary text not null,
  body text not null, -- current canonical version of the policy/ordinance text
  current_version int not null default 1,

  -- flexible geography: pick ONE mode of entry
  geography_scope text not null check (
    geography_scope in ('address', 'neighborhood', 'council_district', 'zip', 'citywide')
  ),
  geography_label text, -- human-readable ("Fishtown", "19125", "Frankford & Girard")
  -- Structured, independent of the proposer's own residence — someone can
  -- propose something for a district they don't live in. Only set when
  -- geography_scope = 'council_district'. Philadelphia has 10 districts.
  council_district int check (council_district between 1 and 10),
  geography_point geography(Point, 4326),   -- dropped pin
  geography_polygon geography(Polygon, 4326), -- drawn area
  image_url text, -- optional cover image, stored in the "proposal-images" bucket
  -- Focal point for the cover image crop, as a 0-100 percentage pair fed
  -- into CSS object-position, so owners can drag to keep the important
  -- part of the photo visible instead of always cropping dead-center.
  image_position_x smallint not null default 50 check (image_position_x between 0 and 100),
  image_position_y smallint not null default 50 check (image_position_y between 0 and 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proposal_tags (
  proposal_id uuid references public.proposals(id) on delete cascade,
  tag_id int references public.tags(id) on delete cascade,
  primary key (proposal_id, tag_id)
);

-- Anyone signed in can propose a new tag on a proposal; it sits pending
-- until an admin approves it (creating the real row in `tags` and
-- attaching it to this proposal) or rejects it. Same review-queue shape
-- as the "suggested edit" flow on comments, just for tags.
create table public.tag_suggestions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  suggested_by uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- Frozen snapshot each time the owner advances the canonical text.
-- Comments attach to a version so "was this addressed" stays legible over time.
create table public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version_number int not null,
  body text not null,
  change_note text, -- owner's short note on what changed and why
  created_at timestamptz not null default now(),
  unique (proposal_id, version_number)
);

-- Per-proposal decision-making / power tree: who this specific proposal would
-- actually have to move through, built by the owner from the shared
-- decision_makers registry (with "add new" when someone's missing).
create table public.proposal_power_tree_nodes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  decision_maker_id uuid not null references public.decision_makers(id),
  parent_node_id uuid references public.proposal_power_tree_nodes(id),
  note text, -- e.g. "final sign-off", "committee review first"
  sort_order int not null default 0,
  -- Open to the whole community, not just the proposal owner: anyone
  -- signed in can suggest adding a decision-maker to the chain. The
  -- owner's own additions land approved immediately (unchanged
  -- behavior); anyone else's land pending until the owner approves or
  -- removes them, so the chain stays owner-curated even though
  -- suggestions can come from anywhere.
  status text not null default 'approved' check (status in ('pending', 'approved')),
  submitted_by uuid references public.profiles(id), -- who suggested it, if not the owner
  created_at timestamptz not null default now()
);

-- Running log of dated notes on a specific decision-maker within a
-- specific proposal's chain — separate from the single "note" field
-- above (that's a role, this is many entries over time: when someone
-- talked to them, what came of it, what's useful to know for next
-- time). Crowdsourced like the decision-maker registry itself — any
-- signed-in person can add one, not just the proposal owner.
create table public.power_tree_node_updates (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.proposal_power_tree_nodes(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  -- Single-level replies only (a reply can't itself be replied to) — kept
  -- intentionally simple since this is a dated log, not a full comment
  -- thread; that already exists elsewhere on a proposal.
  parent_update_id uuid references public.power_tree_node_updates(id) on delete cascade,
  -- Tracks actual outreach, not just commentary — the point of this log
  -- is to see whether people are following through and really talking to
  -- decision-makers, not just discussing them.
  talked_to boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Comments + suggested edits (a suggested edit is a comment with a proposed
-- replacement body and a status the proposal owner controls)
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version_id uuid not null references public.proposal_versions(id),
  parent_comment_id uuid references public.comments(id), -- threaded replies
  author_id uuid not null references public.profiles(id),
  body text not null,

  is_suggested_edit boolean not null default false,
  suggested_body text, -- only set when is_suggested_edit = true

  status text not null default 'open' check (
    status in ('open', 'accepted', 'rejected', 'accepted_with_contingency')
  ),
  status_note text, -- owner's note when resolving (e.g. the contingency)

  -- commenter-raised marker after a NEW version ships, without blocking it
  unresolved_flagged boolean not null default false,

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reactions: upvote/downvote on proposals or comments
-- ---------------------------------------------------------------------------
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  proposal_id uuid references public.proposals(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  constraint reactions_target_check check (
    (proposal_id is not null and comment_id is null) or
    (proposal_id is null and comment_id is not null)
  )
);

-- Two partial unique indexes instead of one combined constraint — Postgres
-- treats every NULL as distinct, so a single unique(user_id, proposal_id,
-- comment_id) constraint silently fails to stop duplicate votes on
-- proposals (where comment_id is NULL every time). This is the fix.
create unique index reactions_unique_proposal_vote
  on public.reactions (user_id, proposal_id) where comment_id is null;
create unique index reactions_unique_comment_vote
  on public.reactions (user_id, comment_id) where proposal_id is null;

-- ---------------------------------------------------------------------------
-- Escalation flags: crowdsourced, not automatic. A proposal crossing a
-- flag/support threshold surfaces in a review queue Samantha (or a future
-- partner) checks manually — nothing gets auto-emailed to officials or counsel.
-- ---------------------------------------------------------------------------
create table public.proposal_flags (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  flag_type text not null check (
    flag_type in ('ready_to_escalate', 'needs_legal_counsel')
  ),
  created_at timestamptz not null default now(),
  unique (proposal_id, user_id, flag_type)
);

-- ---------------------------------------------------------------------------
-- Seed reference data — first pass, editable later without a redeploy
-- ---------------------------------------------------------------------------
insert into public.categories (slug, label, description, requires_budget, sort_order, color) values
  ('public_safety', 'Public Safety', 'Police, fire, prisons, and criminal justice.', true, 1, '#8358D3'),
  ('benefits_pensions', 'Benefits and Pensions', 'Employee retirement contributions and health care fringe benefits.', true, 2, '#F86767'),
  ('general_government', 'General Government Operations', 'Administration, internal tech, legal, fleet, and facilities.', true, 3, '#4069D9'),
  ('infrastructure_sanitation', 'Infrastructure and Sanitation', 'Streets, cleaning, and transit support.', true, 4, '#FF74A5'),
  ('culture_leisure', 'Culture and Leisure', 'Parks, recreation, libraries, and arts.', true, 5, '#6BAB68'),
  ('education_subsidies', 'Education and Subsidies', 'Support for the school district and community college.', true, 6, '#FF881A'),
  ('governance_process', 'Governance and Civic Process', 'Structural/procedural proposals with no direct budget line — term limits, election rules, redistricting, ethics rules, charter changes.', false, 7, '#FBE968');

insert into public.tags (slug, label) values
  ('children', 'Children'),
  ('youth', 'Youth'),
  ('seniors', 'Seniors'),
  ('immigrants_refugees', 'Immigrants & Refugees'),
  ('art', 'Art'),
  ('culture', 'Culture'),
  ('historic_preservation', 'Historic Preservation'),
  ('bicycle_safety', 'Bicycle Safety'),
  ('pedestrian_safety', 'Pedestrian Safety'),
  ('safe_streets', 'Safe Streets'),
  ('leisure', 'Leisure'),
  ('work_economy', 'Work & Economy'),
  ('tourism', 'Tourism'),
  ('food_access', 'Food Access'),
  ('education', 'Education'),
  ('parks_greenspace', 'Parks & Greenspace'),
  ('trash_waste', 'Trash & Waste'),
  ('better_governance', 'Better Governance'),
  ('health_wellness', 'Health & Wellness');

-- Small starter list of decision-makers so the dropdown isn't empty on day
-- one. Expand freely — this is meant to grow via "add new" in the UI, not
-- stay a fixed list maintained in code.
insert into public.decision_makers (name, kind) values
  ('Mayor of Philadelphia', 'elected_official'),
  ('Philadelphia City Council (full body)', 'elected_official'),
  ('City Council Committee of the Whole', 'elected_official'),
  ('Streets Department', 'department'),
  ('Philadelphia Police Department', 'department'),
  ('Parks & Recreation Department', 'department'),
  ('City Planning Commission', 'board_commission'),
  ('Zoning Board of Adjustment', 'board_commission'),
  ('School District of Philadelphia', 'department');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.zip_council_districts enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.decision_makers enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_tags enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.proposal_power_tree_nodes enable row level security;
alter table public.power_tree_node_updates enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.proposal_flags enable row level security;
alter table public.tag_suggestions enable row level security;

-- Reference data + published content: readable by anyone
create policy "public read categories" on public.categories for select using (true);
create policy "public read tags" on public.tags for select using (true);
create policy "public read decision makers" on public.decision_makers for select using (true);
create policy "public read proposal power tree" on public.proposal_power_tree_nodes for select using (true);
create policy "public read power_tree_node_updates" on public.power_tree_node_updates for select using (true);
create policy "public read proposals" on public.proposals for select using (true);
create policy "public read proposal_tags" on public.proposal_tags for select using (true);
create policy "public read proposal_versions" on public.proposal_versions for select using (true);
create policy "public read comments" on public.comments for select using (true);
create policy "public read reactions" on public.reactions for select using (true);
create policy "public read flags" on public.proposal_flags for select using (true);
create policy "public read zip council districts" on public.zip_council_districts for select using (true);
create policy "public read tag_suggestions" on public.tag_suggestions for select using (true);

-- Profiles: anyone can read display names; only the owner can update their own row
create policy "public read profiles" on public.profiles for select using (true);
create policy "user manages own profile" on public.profiles for update using (auth.uid() = id);
create policy "user creates own profile" on public.profiles for insert with check (auth.uid() = id);

-- Writes require a verified, logged-in user (email verification handled by Supabase Auth)
create policy "authenticated create proposals" on public.proposals for insert
  with check (auth.uid() = owner_id);
create policy "owner updates own proposal" on public.proposals for update
  using (auth.uid() = owner_id);

create policy "authenticated create proposal_tags" on public.proposal_tags for insert
  with check (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));
create policy "owner removes own proposal_tags" on public.proposal_tags for delete
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));

create policy "authenticated create versions" on public.proposal_versions for insert
  with check (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));

create policy "authenticated create comments" on public.comments for insert
  with check (auth.uid() = author_id);
create policy "owner resolves comments on own proposal" on public.comments for update
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));
create policy "author edits own comment" on public.comments for update
  using (auth.uid() = author_id);

create policy "authenticated create reactions" on public.reactions for insert
  with check (auth.uid() = user_id);
create policy "user removes own reaction" on public.reactions for delete
  using (auth.uid() = user_id);

create policy "authenticated create flags" on public.proposal_flags for insert
  with check (auth.uid() = user_id);

create policy "authenticated create tag_suggestions" on public.tag_suggestions for insert
  with check (auth.uid() = suggested_by);
create policy "admin updates tag_suggestions" on public.tag_suggestions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Approving a suggestion inserts a brand-new row into the shared tags
-- table — previously nothing but the initial seed data could do that.
create policy "admin inserts tags" on public.tags for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Anyone signed in can add a missing decision-maker to the shared registry
-- (crowdsourced, like the rest of the platform) — but only the proposal
-- owner curates which ones apply to their own proposal's tree.
create policy "authenticated add decision makers" on public.decision_makers for insert
  with check (auth.uid() = added_by);
-- Deletion is admin-only, not open to whoever added the entry — the
-- registry is shared/crowdsourced, so anyone's typo or duplicate (e.g.
-- a lowercase "quetcy lozada" alongside the real "Quetcy Lozada") needs
-- cleanup by someone who can see the whole list, not just its author.
create policy "admin deletes decision makers" on public.decision_makers for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Anyone signed in can suggest a decision-maker for the chain, not just
-- the owner — the app layer (addPowerTreeNode) decides whether that
-- lands as 'approved' (owner) or 'pending' (everyone else).
create policy "authenticated contribute to power tree" on public.proposal_power_tree_nodes for insert
  with check (auth.role() = 'authenticated');
create policy "owner edits own power tree" on public.proposal_power_tree_nodes for delete
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));
-- Every insert (including a non-owner's suggestion) is immediately
-- followed by a full reindex — every node's sort_order gets rewritten
-- to match its new array position, so the new entry lands exactly
-- where it was inserted. That reindex is a batch of UPDATEs. When this
-- policy was owner-only, a non-owner's suggestion could INSERT fine
-- but every one of those follow-up UPDATEs was silently rejected by
-- RLS (the app never checked for the error) — so the new node kept its
-- placeholder sort_order (always the highest value that exists),
-- which is why it always rendered at the very top of the chain no
-- matter which "+" was used, and stayed there even after approval
-- (approving never touches sort_order). Opened to any authenticated
-- user, matching the insert policy — the actions that actually need
-- owner-only enforcement (drag-reorder, approve) already check
-- ownership themselves in the server action, before ever touching the
-- database.
create policy "authenticated reindex power tree" on public.proposal_power_tree_nodes for update
  using (auth.role() = 'authenticated');

create policy "authenticated add power_tree_node_updates" on public.power_tree_node_updates for insert
  with check (auth.uid() = author_id);

-- Civic report card / "add a log" — self-reported off-platform civic
-- actions (letters to the editor, community meetings, volunteer hours,
-- testimony). One flexible table for all four types, rather than four
-- separate tables, so a person's whole log is one feed instead of a
-- merge of four queries every time.
create table public.civic_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_type text not null check (log_type in ('letter_to_editor', 'community_meeting', 'volunteer_hours', 'testimony')),
  occurred_on date not null default current_date,
  -- letter_to_editor only:
  title text,
  published boolean not null default false,
  published_link text,
  -- community_meeting only — free text for now; a future iteration
  -- links this to a real organization profile (see
  -- platform-future-iterations notes).
  organization text,
  -- volunteer_hours only:
  hours numeric,
  category text,
  -- any type, optional:
  note text,
  -- 'draft' = auto-saved when the add-a-log window was closed before
  -- finishing, so nothing typed is ever just lost — visible only to
  -- the person who started it, and left out of the public report card
  -- counts until they come back and finish it.
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);
alter table public.civic_logs enable row level security;
create policy "read published or own civic logs" on public.civic_logs for select
  using (status = 'published' or user_id = auth.uid());
create policy "authenticated create own civic logs" on public.civic_logs for insert
  with check (auth.uid() = user_id);
create policy "owner updates own civic logs" on public.civic_logs for update
  using (auth.uid() = user_id);
create policy "owner deletes own civic logs" on public.civic_logs for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: proposal cover images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('proposal-images', 'proposal-images', true)
on conflict (id) do nothing;

create policy "public read proposal images" on storage.objects for select
  using (bucket_id = 'proposal-images');
create policy "authenticated upload proposal images" on storage.objects for insert
  with check (bucket_id = 'proposal-images' and auth.role() = 'authenticated');
create policy "authenticated update own proposal images" on storage.objects for update
  using (bucket_id = 'proposal-images' and auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Storage: profile avatars
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "authenticated upload avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "authenticated update own avatars" on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');
