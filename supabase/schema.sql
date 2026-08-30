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
  housing_status text, -- homeowner / renter / unhoused / prefer not to say — same treatment as the other demographics: optional, aggregate-only, never shown on a public profile
  -- Same treatment as the other demographics above: optional, self-reported,
  -- aggregate-only. The point is being able to show that support for
  -- quality-of-life proposals isn't confined to one party — never shown
  -- next to a person's name or on their public profile, anywhere, under
  -- any circumstance. (RLS on this table is row-level, not column-level —
  -- see the note above the "public read profiles" policy below. The real
  -- guarantee is that no query in this codebase ever selects this column
  -- except the owner editing their own profile and the server-side
  -- aggregate count on the community dashboard, neither of which returns
  -- a raw, per-person value to the client.)
  political_affiliation text,
  educational_attainment text, -- 6th optional demographic, same aggregate-only treatment — added so this can be compared against real Census data (ACS table B15002)
  bio text, -- short, optional civic summary shown on the person's PUBLIC profile (/u/[id]) — the only free-text field that's ever public
  accepted_guidelines_at timestamptz, -- respectful-dialogue prompt acknowledgment
  is_admin boolean not null default false, -- gates admin-only screens, e.g. tag-suggestion review
  is_blocked boolean not null default false, -- admin-set; stops new writes only, never hides past content
  avatar_url text, -- optional profile picture, stored in the "avatars" bucket
  -- Read on /profile, then immediately bumped to now() right after —
  -- lets the profile page show "what's new since you were last here"
  -- (new comments/replies on your stuff, unresolved suggested edits)
  -- without a separate notifications table.
  notifications_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Which council districts a given zip code actually overlaps, so a
-- self-reported district can be sanity-checked (a 19122 zip claiming
-- District 1 is flatly impossible) without ever collecting a home address.
-- Many-to-many on purpose — some zips straddle more than one district.
-- Populated from a real spatial join of OpenDataPhilly's "Zip Codes" and
-- "City Council Districts" GeoJSON layers (Samantha downloaded both and
-- handed them over; the join itself ran in shapely, not PostGIS, since
-- it only needed to run once, not live). overlap_pct is what percentage
-- of that zip's area falls in that district — lets the app auto-suggest
-- the majority district instead of just flagging impossible combos.
create table public.zip_council_districts (
  zip_code text not null,
  council_district int not null,
  overlap_pct numeric,
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

-- Curated, admin-managed grouping layer above tags (e.g. "Pedestrian &
-- Bike Safety" containing "bike lanes", "bike safety", "pedestrians", ...)
-- — same idea as volunteer_category_groups below, for the same reason:
-- lets the community dashboard roll engagement up to a handful of
-- readable topics instead of listing out however many individual tags
-- exist. A small, deliberate list Samantha curates herself; tags don't
-- require a group (a brand-new tag starts ungrouped until she assigns
-- it one on the admin page).
create table public.tag_groups (
  id serial primary key,
  label text unique not null,
  -- Same idea as categories.color — each topic gets its own accent so
  -- "Proposals by topic" on the community dashboard can color-code each
  -- bar instead of every one of them being the same flat purple. Nullable
  -- (falls back to a neutral grey bar) since a brand-new topic starts
  -- without one until it's set on the admin page.
  color text,
  created_at timestamptz not null default now()
);

create table public.tags (
  id serial primary key,
  slug text unique not null,
  label text not null,
  group_id int references public.tag_groups(id) on delete set null
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

-- Crowdsourced public profile for an elected official — v1 is scoped to
-- kind = 'elected_official' only (a department or board doesn't have a
-- term, an election, or committees, so this whole table just doesn't
-- apply to those). One row per decision_maker, created on first edit
-- (not seeded automatically), which is why every column here is
-- nullable/has a safe default rather than being required at insert time.
-- Deliberately NOT the same trust model as decision_makers/grants above
-- (where only an admin can update an existing entry) — Samantha's ask
-- was explicit: "these profiles are by the people," wiki-style, so any
-- signed-in user can edit any field here. decision_maker_revisions right
-- below is what keeps that accountable (every change is logged with who
-- made it), and an admin can still overwrite or the row can be deleted
-- if something's vandalized.
create table public.decision_maker_profiles (
  decision_maker_id uuid primary key references public.decision_makers(id) on delete cascade,
  -- Some decision_makers rows are an OFFICE, not a person ("Mayor of
  -- Philadelphia," "City Council Committee of the Whole") — seeded that
  -- way on purpose so the entity outlives any one term. This is where
  -- the actual current officeholder's name goes, shown as a subtitle
  -- right under the office name on the profile card.
  current_officeholder text,
  office_title text,
  elected_date date,
  term_end_date date,
  next_election_date date,
  -- Who they represent, kept deliberately simple (Samantha's call): one
  -- of a specific council district, the whole city, or not applicable —
  -- not a list of districts. A citywide official's profile just shows
  -- "represents 100% of Citizen Mayors" rather than needing anything
  -- more elaborate.
  represents_scope text not null default 'n/a'
    check (represents_scope in ('district', 'citywide', 'n/a')),
  represents_district int,
  -- Array of {"name": "...", "role": "chair" | "vice_chair" | "member"}
  -- objects — a chair/vice-chair distinction matters (it's real, public
  -- information about who actually runs a committee's agenda), so a flat
  -- list of names alone wasn't enough.
  committees jsonb not null default '[]'::jsonb,
  -- Same free-text idea as profiles.political_affiliation (not a fixed
  -- enum) — an elected official's actual party is a matter of public
  -- record, not self-reported, so this is just a plain text field
  -- anyone can fill in from what they know (Democrat, Republican,
  -- Independent, Working Families, etc.), not limited to the options on
  -- a resident's own profile.
  party_affiliation text,
  how_they_show_up text not null default '',
  what_they_care_about text not null default '',
  -- Same server-action + Storage-bucket pattern as proposal cover images
  -- and profile avatars (see migration_dm_org_photos_and_issue_tags.sql)
  -- — no focal-point repositioning like proposal covers, just a simple
  -- circular photo like the avatar gets.
  photo_url text,
  updated_at timestamptz not null default now()
);

-- "Issue tags" — reuses the same shared `tags` registry proposals tag
-- themselves with, so tagging a decision-maker as active on "Housing"
-- means the same thing everywhere on the site. Existing-tag-only (see
-- migration_dm_org_photos_and_issue_tags.sql for why there's no
-- suggest-a-brand-new-tag flow here) and no approval step to attach one
-- — same "informational lead" trust level as proposal_grants below, not
-- the higher bar a decision-chain node claiming someone's actual
-- support needs.
create table public.decision_maker_tags (
  decision_maker_id uuid not null references public.decision_makers(id) on delete cascade,
  tag_id int not null references public.tags(id) on delete cascade,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (decision_maker_id, tag_id)
);

-- Structured, one-row-per-bill record of what an elected official has
-- introduced or taken a position on — kept separate from the freeform
-- wiki text above specifically so it's filterable/scannable (Samantha's
-- explicit pick over a paragraph of prose) rather than buried in a
-- paragraph you'd have to read start to finish.
create table public.decision_maker_legislation (
  id uuid primary key default gen_random_uuid(),
  decision_maker_id uuid not null references public.decision_makers(id) on delete cascade,
  title text not null,
  stance text not null check (stance in ('introduced', 'for', 'against')),
  note text,
  occurred_on date,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- The audit trail that makes wide-open wiki editing safe enough to ship:
-- every edit to a profile field (or a new legislation entry) writes one
-- row here, so the profile's "History" section can show what changed,
-- when, and by whom — the same accountability Wikipedia's page-history
-- tab provides, just field-level rather than a true text diff (a lot
-- simpler to build, and enough to spot and undo vandalism).
create table public.decision_maker_revisions (
  id uuid primary key default gen_random_uuid(),
  decision_maker_id uuid not null references public.decision_makers(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  edited_by uuid references public.profiles(id),
  edited_at timestamptz not null default now()
);

-- Civic organizations (neighborhood groups, civic associations) —
-- same shared-registry shape as decision_makers: grows via "add new"
-- when someone attaches one to their own profile that isn't in the
-- list yet (see organization_profiles below / profile_organizations
-- further down), rather than being pre-seeded.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index organizations_name_idx on public.organizations (lower(name));

-- Crowdsourced public profile for a civic organization — same wiki
-- model and same reasoning as decision_maker_profiles above (anyone
-- signed in can edit; decision_maker_revisions'/organization_revisions'
-- accountability trail is what makes that safe, not a narrower update
-- policy). One row per organization, created on first edit.
create table public.organization_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  -- Structured, not free text — the first version let anyone type
  -- anything ("South Philly," "point breeze," "Dist. 2"...), which
  -- meant no two entries reliably matched and the data was useless to
  -- aggregate. Reuses the exact same shape proposals already use for
  -- geography (geography_scope/council_district/geography_label in the
  -- proposals table) so an org's service area is a real, filterable
  -- value — a dropdown, not a guess at spelling.
  geography_scope text not null default 'citywide'
    check (geography_scope in ('citywide', 'council_district', 'zip')),
  council_district int,
  geography_label text, -- holds the zip code when geography_scope = 'zip'
  topics text[] not null default '{}',
  description text not null default '',
  meets_when text,
  meets_where text,
  -- Same pattern as decision_maker_profiles.photo_url above.
  logo_url text,
  updated_at timestamptz not null default now()
);

create table public.organization_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  edited_by uuid references public.profiles(id),
  edited_at timestamptz not null default now()
);

-- The "attached to my profile" join Samantha asked for — a member adds
-- a neighborhood group or civic org to their own profile (creating the
-- shared organizations registry row if it doesn't exist yet, same
-- match-or-create pattern as grants/decision-makers), and that's what
-- drives an organization profile's "Serves # Citizen Mayors" count.
-- Deliberately does NOT expose WHICH members belong to an org anywhere
-- public — same aggregate-only stance as the demographic-privacy work —
-- only the count is ever shown, never a roster.
create table public.profile_organizations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, organization_id)
);

-- Shared, crowdsourced registry of grants/funding programs — same shape
-- and same trust model as decision_makers above (anyone signed in can
-- add a new one, only an admin can rename or remove it from the shared
-- list), so the same state grant program doesn't get retyped slightly
-- differently on every proposal that could use it. Attaching one to a
-- specific proposal (proposal_grants, right below) is open too, with no
-- approval step — a grant lead is "go check this out," not a claim made
-- on the proposal's behalf, so it doesn't need the same owner-approval
-- gate as a decision-maker suggestion does.
create table public.grants (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- e.g. "PA DCED Redevelopment Assistance Capital Program"
  funder text, -- who administers/offers it, e.g. "PA Dept of Community & Economic Development"
  url text,
  description text, -- what it typically funds / eligibility, in plain language
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index grants_name_idx on public.grants (lower(name));

-- Links a grant to a specific proposal it might fund. `note` is the
-- proposal-specific context ("this would likely qualify under the parks
-- improvement track") — the grant row itself only holds the general,
-- reusable description.
create table public.proposal_grants (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  grant_id uuid not null references public.grants(id) on delete cascade,
  note text,
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (proposal_id, grant_id)
);

-- Precedent & case studies — a proposal-specific sidebar box (below
-- Tags) where anyone can attach a real-world example: a similar
-- project elsewhere, how it got funded, who was involved, what
-- challenges came up. Meant to help with grant applications — "here's
-- precedent this kind of thing works and gets funded." Same trust
-- model as proposal_grants right above: wide-open insert for any
-- signed-in resident, no approval step, but only the proposal OWNER or
-- an admin can remove one back out (not the person who added it).
create table public.proposal_case_studies (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  project_name text not null,
  location text,
  cost text, -- free text on purpose — real-world figures are often approximate or ranges
  funding_source text,
  who_was_involved text,
  challenges_feedback text,
  source_url text,
  submitted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Petition support — NOT a signature-collection system in its own right
-- (that's Change.org's job; see the petition-drafting box on the
-- proposal page, which composes text and hands off to Change.org's own
-- start-a-petition flow rather than reinventing it). This table is
-- just the on-platform signal: "N Citizen Mayors are behind starting a
-- petition on this." Unlike proposal_case_studies/proposal_grants
-- above, removal belongs to the SUPPORTER themselves (or an admin), not
-- the proposal owner — a signature is a statement about the signer,
-- not curation over someone else's sidebar. One row per person per
-- proposal (the unique constraint below), so re-clicking "I support
-- this" can't inflate the count.
create table public.proposal_petition_supporters (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (proposal_id, user_id)
);

-- "Report an issue" — the floating widget in the corner of every page
-- (see feedback-widget.tsx, rendered from the root layout). Built for
-- the soft-launch working-group batch: a low-friction way to flag
-- something confusing or broken without emailing Samantha directly, and
-- a real signal for what the click-through tutorial (still unbuilt)
-- needs to cover. Deliberately NOT gated on being signed in — someone
-- can hit a confusing moment before they've ever logged in, and
-- shouldn't have to sign in just to say so. page_path is captured
-- automatically (whatever page they were on), not typed by hand.
-- Admin-only to read, same as the rest of this app's moderation-style
-- tables; nobody needs to see what anyone else reported.
create table public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  page_path text,
  user_id uuid references public.profiles(id) on delete set null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Shared, crowdsourced list of volunteer-hours categories (Environment,
-- Youth, Food security, etc.) — same "grows via add-new" pattern as
-- decision_makers and tags. Exists so "hours by category" reporting on
-- the community dashboard is actually meaningful instead of splitting
-- across "Environment" / "environment" / "enviro" as separate buckets.
-- civic_logs.category stores the label as plain text (not a foreign
-- key) — deleting a category from this registry only removes it as a
-- future suggestion, it never rewrites or orphans past log entries.
-- Curated, admin-managed grouping layer above volunteer_categories (e.g.
-- "Environmental" containing Permaculture, Farming, Ecovillages, ...) — a
-- fixed, small list Samantha manages herself, unlike volunteer_categories
-- below which grows on its own as people type new ones. Lets "hours by
-- category" on the community dashboard roll up to a handful of readable
-- buckets instead of dozens of individual tags.
create table public.volunteer_category_groups (
  id serial primary key,
  label text unique not null,
  created_at timestamptz not null default now()
);

create table public.volunteer_categories (
  id serial primary key,
  label text unique not null,
  -- Optional — a brand-new tag someone types while logging hours starts
  -- ungrouped; Samantha assigns it to a group herself on the admin page
  -- whenever she gets to it, rather than asking the person mid-form to
  -- pick from a list of groups they've never seen.
  group_id int references public.volunteer_category_groups(id) on delete set null,
  created_at timestamptz not null default now()
);

-- "What you did" (volunteer_categories above) and "who it was for" used
-- to be forced into the same single field — tutoring someone's kids and
-- tutoring an ESL class for seniors had no way to both be "Tutoring,"
-- since picking a population-flavored category (Children & Youth, Senior
-- Citizens) instead of the activity meant losing the activity, and vice
-- versa. This is the second, independent, optional field: who the hours
-- actually served, separate from what the activity was.
--
-- Deliberately NOT "grows as you type" like volunteer_categories — the
-- whole point of splitting this out is to stop taxonomy sprawl, so this
-- stays a small, fixed, admin-only list (same shape as `categories` and
-- `tag_groups`: public read, admin add/update/delete, nobody else can
-- insert a new one just by typing it while logging hours).
create table public.population_categories (
  id serial primary key,
  label text unique not null,
  created_at timestamptz not null default now()
);

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
  geography_point geography(Point, 4326),   -- dropped pin (future manual-pin feature, unused so far)
  geography_polygon geography(Polygon, 4326), -- drawn area
  -- Real coordinates for an 'address' scope proposal, filled in
  -- automatically via the Census geocoder (see geocode-address.ts) when
  -- the proposal is created or its geography is edited. Plain doubles
  -- rather than the geography_point column above — see
  -- migration_proposal_geocoding.sql for why.
  geocoded_lat double precision,
  geocoded_lng double precision,
  image_url text, -- optional cover image, stored in the "proposal-images" bucket
  -- Focal point for the cover image crop, as a 0-100 percentage pair fed
  -- into CSS object-position, so owners can drag to keep the important
  -- part of the photo visible instead of always cropping dead-center.
  image_position_x smallint not null default 50 check (image_position_x between 0 and 100),
  image_position_y smallint not null default 50 check (image_position_y between 0 and 100),

  -- Lets an owner take a proposal down from public view without
  -- permanently destroying it (comments, decision chain, and votes all
  -- stay intact underneath) — a reversible alternative to deleting.
  -- The owner can still see and re-publish their own unpublished
  -- proposals; the public-read policy below is what actually hides it
  -- from everyone else.
  published boolean not null default true,

  -- Optional, owner-editable description of the actual first step at
  -- the fixed "We the people" anchor in the decision chain (e.g. "Write
  -- proposal", "Make petition") — that anchor has no other fields of
  -- its own; it's a static label in the UI, not a real power-tree node.
  people_action_note text,

  -- Owner-set flag, off by default. Some proposals genuinely don't need
  -- funding at all (a policy change costs nothing to pass); others are
  -- completely reliant on it. Rather than showing a "Funding & grants"
  -- subsection on every single proposal whether it's relevant or not,
  -- this flag is what reveals that subsection under "Getting it done" —
  -- see proposal_grants below.
  funding_needed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proposal_tags (
  proposal_id uuid references public.proposals(id) on delete cascade,
  tag_id int references public.tags(id) on delete cascade,
  -- Lets the notification bell time-gate "a tag you follow just showed up
  -- on a proposal" the same way every other bell item is time-gated
  -- (created_at > notifications_seen_at) — see profile_followed_tags
  -- below and getNotifications() in lib/notifications.ts. A brand-new
  -- proposal's initial tags get this at creation time, and a tag added
  -- later to an existing proposal (the tag-suggestion approval flow)
  -- gets it then — one column covers both cases Samantha asked for
  -- ("new proposals AND later tag additions") without two separate code
  -- paths to keep in sync.
  created_at timestamptz not null default now(),
  primary key (proposal_id, tag_id)
);

-- Tags a resident follows on their own profile — the "crowdsourced
-- expertise" piece: pick the topics you know about or care about, and
-- get alerted (via the notification bell, see getNotifications()) when a
-- proposal shows up carrying one of them, whether that's a brand-new
-- proposal or an existing one that just got tagged with it. Deliberately
-- NOT scoped to geography (citywide/district) — Samantha's call: someone
-- who knows zoning law might want to weigh in citywide, not just in
-- their own council district, so expertise shouldn't be fenced off by
-- where you happen to live.
create table public.profile_followed_tags (
  profile_id uuid references public.profiles(id) on delete cascade,
  tag_id int references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, tag_id)
);

-- Anyone signed in can propose a tag on a proposal they don't own — the
-- review path depends on whether it's a tag that already exists or a
-- brand-new one (tag_id set vs. null, resolved server-side by matching
-- the typed label against the real tags table):
--   existing tag  (tag_id set):  pending -> approved (owner OR admin) | rejected
--   brand-new tag (tag_id null): pending -> owner_approved (owner only,
--                                 doesn't attach anything yet) -> approved
--                                 (admin only, creates the real tags row
--                                 and attaches it) | rejected (either)
-- The point of the two-step path for brand-new tags: an admin approving
-- one can never populate a proposal's tags on its own — the owner has
-- to have already said yes first. An existing tag needs only the
-- owner's say-so, since nothing new is being created, just attached.
create table public.tag_suggestions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  suggested_by uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  tag_id int references public.tags(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'owner_approved', 'approved', 'rejected')),
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

-- Per-proposal decision-making / power tree: who (or what) this specific
-- proposal would actually have to move through, built by the owner from
-- the shared decision_makers registry (with "add new" when someone's
-- missing).
--
-- decision-maker only, going forward — this used to also hold 'funding'
-- nodes (money needed at some point in the chain), but Samantha's call:
-- the chain should be purely the approval/permission path ("who has to
-- say yes"), not a mix of who-approves-this and how-does-it-get-paid-
-- for. Funding now lives in proposal_phases below instead, as part of
-- actually DOING the thing rather than a rung on the permission ladder.
-- See migration_phases.sql for how existing funding nodes moved over.
create table public.proposal_power_tree_nodes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  node_type text not null default 'decision_maker' check (node_type = 'decision_maker'),
  decision_maker_id uuid not null references public.decision_makers(id),
  parent_node_id uuid references public.proposal_power_tree_nodes(id),
  note text, -- e.g. "final sign-off"
  sort_order int not null default 0,
  -- Open to the whole community, not just the proposal owner: anyone
  -- signed in can suggest a decision-maker for the chain. The owner's
  -- own additions land approved immediately (unchanged behavior);
  -- anyone else's land pending until the owner approves or removes
  -- them, so the chain stays owner-curated even though suggestions can
  -- come from anywhere.
  status text not null default 'approved' check (status in ('pending', 'approved')),
  submitted_by uuid references public.profiles(id), -- who suggested it, if not the owner
  -- Marks a link as actually done — this decision-maker really engaged.
  -- Visual, motivating progress marker on the chain, not a permission
  -- gate; any node can be checked off and unchecked again.
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  -- Bumped whenever status changes (e.g. approved) — lets notifications
  -- tell "your suggested link was approved" apart from "you just added
  -- this," since a fresh row's created_at and updated_at start equal.
  updated_at timestamptz not null default now()
);

-- Implementation phases — the "how does this actually get done" half,
-- separate from the decision chain above ("who has to say yes"). Seeded
-- conceptually from Samantha's sketch: every proposal implicitly starts
-- at "write proposal" (that's the proposal itself, not a row here), and
-- from there a resident sees phases other proposals in the same
-- category have used (see getRecommendedPhases in proposals/actions.ts
-- — plain frequency off real usage, no separate admin-curated template
-- table to maintain) as one-click suggestions, or can add their own.
-- Funding now lives here too (see label/note on a migrated phase) — it's
-- something you secure DURING implementation, not something you need
-- permission for.
create table public.proposal_phases (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  label text not null,
  note text,
  sort_order int not null default 0,
  -- Actual completion state — separate from `status` below (pending vs.
  -- approved), same split as the decision chain's completed/status pair,
  -- just named to fit a 3-state progress bar instead of a boolean.
  progress text not null default 'not_started' check (progress in ('not_started', 'in_progress', 'done')),
  -- Same crowdsourced-suggestion model as the decision chain: anyone
  -- signed in can propose a phase; the owner's own additions land
  -- approved immediately, anyone else's land pending until approved.
  status text not null default 'approved' check (status in ('pending', 'approved')),
  added_by uuid references public.profiles(id),
  -- The real, live petition link (e.g. on Change.org), once one exists.
  -- Only meaningful on a phase whose label reads as a petition (see
  -- isPetitionPhase in phases-section.tsx) — null on every other phase.
  -- Owner pastes it in after actually creating the petition elsewhere;
  -- once set, it becomes the primary "Sign the petition" link on this
  -- phase and in the "active petition" banner at the top of the
  -- proposal page, instead of just the generic Change.org starter link.
  petition_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  ('benefits_pensions', 'Public Employment & Benefits', 'City jobs and salaries, plus employee retirement and health care benefits.', true, 2, '#F86767'),
  ('general_government', 'General Government Operations', 'Administration, internal tech, legal, fleet, and facilities.', true, 3, '#4069D9'),
  ('infrastructure_sanitation', 'Infrastructure and Sanitation', 'Streets, cleaning, and transit support.', true, 4, '#FFAFCB'),
  ('culture_leisure', 'Culture and Leisure', 'Parks, recreation, libraries, and arts.', true, 5, '#87D183'),
  ('education_subsidies', 'Education and Subsidies', 'Support for the school district and community college.', true, 6, '#FFA550'),
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
  ('School District of Philadelphia', 'department'),
  -- Quasi-public authorities/bodies that come up constantly in real
  -- land-use, waterfront, and neighborhood-development proposals — see
  -- migration_local_authorities_seed.sql for the note on why RCO is one
  -- generic entry rather than every individual neighborhood RCO.
  ('Delaware River Waterfront Corporation (DRWC)', 'board_commission'),
  ('Philadelphia Land Bank', 'board_commission'),
  ('Registered Community Organization (RCO)', 'other'),
  ('Philadelphia Redevelopment Authority (PRA)', 'board_commission'),
  ('Philadelphia Housing Authority (PHA)', 'board_commission'),
  ('Philadelphia Historical Commission', 'board_commission'),
  ('Philadelphia Art Commission', 'board_commission'),
  ('Department of Licenses & Inspections (L&I)', 'department'),
  ('Philadelphia Water Department', 'department'),
  ('SEPTA', 'board_commission');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.zip_council_districts enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.tag_groups enable row level security;
alter table public.profile_followed_tags enable row level security;
alter table public.decision_makers enable row level security;
alter table public.grants enable row level security;
alter table public.proposal_grants enable row level security;
alter table public.proposal_case_studies enable row level security;
alter table public.proposal_petition_supporters enable row level security;
alter table public.site_feedback enable row level security;
alter table public.volunteer_categories enable row level security;
alter table public.volunteer_category_groups enable row level security;
alter table public.population_categories enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_tags enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.proposal_power_tree_nodes enable row level security;
alter table public.proposal_phases enable row level security;
alter table public.power_tree_node_updates enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.proposal_flags enable row level security;
alter table public.tag_suggestions enable row level security;

-- Reference data + published content: readable by anyone
create policy "public read categories" on public.categories for select using (true);
-- Edit-in-place only (no insert/delete) — this is meant to stay a small,
-- deliberate fixed set (the 7 founding budget categories), not something
-- that grows on its own like tags or decision_makers.
create policy "admin updates categories" on public.categories for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "public read tags" on public.tags for select using (true);
create policy "public read decision makers" on public.decision_makers for select using (true);
create policy "public read grants" on public.grants for select using (true);
create policy "public read proposal grants" on public.proposal_grants for select using (true);
create policy "public read proposal case studies" on public.proposal_case_studies for select using (true);
create policy "public read proposal petition supporters" on public.proposal_petition_supporters for select using (true);
create policy "public read volunteer categories" on public.volunteer_categories for select using (true);
-- Anyone signed in can add a brand-new category while logging volunteer
-- hours (same "grows as you use it" idea as decision_makers) — but only
-- an admin can rename or remove one, same split as the decision-maker
-- registry.
create policy "authenticated add volunteer categories" on public.volunteer_categories for insert
  with check (auth.role() = 'authenticated');
create policy "admin updates volunteer categories" on public.volunteer_categories for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin deletes volunteer categories" on public.volunteer_categories for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "public read volunteer category groups" on public.volunteer_category_groups for select using (true);
create policy "admin add volunteer category groups" on public.volunteer_category_groups for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin updates volunteer category groups" on public.volunteer_category_groups for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin deletes volunteer category groups" on public.volunteer_category_groups for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
-- Admin-only in every direction, unlike volunteer_categories above — this
-- list is meant to stay small and deliberate, not grow from what people
-- type while logging hours (see population_categories' table comment).
create policy "public read population categories" on public.population_categories for select using (true);
create policy "admin add population categories" on public.population_categories for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin updates population categories" on public.population_categories for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin deletes population categories" on public.population_categories for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
-- Owner-only in every direction, on purpose — which tags someone follows
-- says something about what they're interested in/expert on, and unlike
-- organization membership (public, since it's just "which civic groups
-- are you part of") this isn't shown anywhere publicly. If the citizen-
-- expert badge feature later needs a public signal, that should be a
-- separate derived/aggregate value, not exposing this table itself.
create policy "user reads own followed tags" on public.profile_followed_tags for select
  using (auth.uid() = profile_id);
create policy "user follows tags" on public.profile_followed_tags for insert
  with check (auth.uid() = profile_id);
create policy "user unfollows own tags" on public.profile_followed_tags for delete
  using (auth.uid() = profile_id);

create policy "public read proposal power tree" on public.proposal_power_tree_nodes for select using (true);
create policy "public read power_tree_node_updates" on public.power_tree_node_updates for select using (true);
-- Unpublished proposals are only visible to their own owner — everyone
-- else (including signed-out visitors) gets exactly the same result as
-- if the row didn't exist. This is the ONLY thing that makes
-- "unpublish" actually hide a proposal; the app layer never filters
-- this out itself.
create policy "public read published proposals" on public.proposals for select
  using (published or auth.uid() = owner_id);
create policy "public read proposal_tags" on public.proposal_tags for select using (true);
create policy "public read proposal_versions" on public.proposal_versions for select using (true);
create policy "public read comments" on public.comments for select using (true);
create policy "public read reactions" on public.reactions for select using (true);
create policy "public read flags" on public.proposal_flags for select using (true);
create policy "public read zip council districts" on public.zip_council_districts for select using (true);
create policy "public read tag_suggestions" on public.tag_suggestions for select using (true);

-- Profiles: anyone can read display names; only the owner can update their own row.
-- IMPORTANT: this is row-level security, not column-level — Postgres RLS
-- can't hide one column of an otherwise-readable row. The private
-- demographic fields (age_range, race_ethnicity, gender, housing_status,
-- political_affiliation) are only ever kept private because the app code
-- never selects them except (a) a user loading their OWN row to edit it,
-- and (b) a server-side aggregate count for the community dashboard that
-- never sends a raw per-person row to the client. If a future query ever
-- does `select("*")` on profiles for a public-facing page, that
-- discipline breaks. A stricter version of this (a view that omits these
-- columns entirely for anon/public reads) would be worth doing if this
-- ever needs a harder guarantee than "the code is careful."
create policy "public read profiles" on public.profiles for select using (true);

-- Column-level hardening on top of the row-level policy above — see
-- migration_harden_private_demographics.sql for the full rationale.
-- Revokes direct SELECT on the six private demographic columns from
-- both API roles; the only two ways to read them are the narrow
-- functions below (self-only, and aggregate-only), regardless of what
-- any query — present or future — tries to select. educational_attainment
-- joined the other five in the same migration that added it
-- (migration_educational_attainment.sql).
revoke select (age_range, race_ethnicity, gender, housing_status, political_affiliation, educational_attainment)
  on public.profiles from anon, authenticated;

create or replace function public.get_my_demographics()
returns table (
  age_range text,
  race_ethnicity text,
  gender text,
  housing_status text,
  political_affiliation text,
  educational_attainment text
)
language sql
security definer
set search_path = public
stable
as $$
  select age_range, race_ethnicity, gender, housing_status, political_affiliation, educational_attainment
  from public.profiles
  where id = auth.uid();
$$;

revoke all on function public.get_my_demographics() from public;
grant execute on function public.get_my_demographics() to authenticated;

create or replace function public.demographic_breakdown(field text, filter_district int default null)
returns table (value text, count bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if field not in ('age_range', 'race_ethnicity', 'gender', 'housing_status', 'political_affiliation', 'educational_attainment') then
    raise exception 'demographic_breakdown: invalid field %', field;
  end if;
  return query execute format(
    'select %1$I as value, count(*) as count
     from public.profiles
     where %1$I is not null and %1$I <> '''' %2$s
     group by %1$I
     order by count(*) desc',
    field,
    case when filter_district is not null then format('and council_district = %L', filter_district) else '' end
  );
end;
$$;

revoke all on function public.demographic_breakdown(text, int) from public;
grant execute on function public.demographic_breakdown(text, int) to authenticated, anon;
create policy "user manages own profile" on public.profiles for update using (auth.uid() = id);
create policy "user creates own profile" on public.profiles for insert with check (auth.uid() = id);

-- Writes require a verified, logged-in user (email verification handled by Supabase Auth)
create policy "authenticated create proposals" on public.proposals for insert
  with check (auth.uid() = owner_id);
create policy "owner updates own proposal" on public.proposals for update
  using (auth.uid() = owner_id);
-- Previously the only way in was creating one — no way to remove one
-- short of asking Samantha to do it by hand. Every child table
-- (comments, proposal_tags, proposal_versions, proposal_power_tree_nodes,
-- reactions, proposal_flags, tag_suggestions) already references
-- proposals with "on delete cascade", so this one delete cleans up the
-- whole proposal's data with no separate cleanup step needed.
create policy "owner deletes own proposal" on public.proposals for delete
  using (auth.uid() = owner_id);
-- Same admin-override idea as "admin deletes decision makers" above — an
-- admin testing the app ends up with a pile of test proposals under
-- their own account, and one-at-a-time deletion from each proposal's own
-- page was the only path. This lets an admin delete ANY proposal (not
-- just their own) straight from the list/card, same as every other
-- admin force-delete override in this schema.
create policy "admin deletes any proposal" on public.proposals for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

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
-- Admin can move a suggestion to any status at any stage (final say,
-- same as before this feature existed).
create policy "admin updates tag_suggestions" on public.tag_suggestions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
-- The proposal's own owner can also respond, but the WITH CHECK below
-- caps what they're allowed to move a suggestion TO: rejecting is
-- always fine (never creates anything), approving outright is only
-- allowed for an existing tag (tag_id set — nothing new gets created),
-- and for a brand-new tag (tag_id null) the owner can only advance it to
-- 'owner_approved', never straight to 'approved' — that final step is
-- admin-only, since it's the one that actually creates the shared tag.
create policy "owner responds to own proposal tag_suggestions" on public.tag_suggestions for update
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()))
  with check (
    status = 'rejected'
    or (status = 'approved' and tag_id is not null)
    or (status = 'owner_approved' and tag_id is null)
  );

-- Approving a suggestion inserts a brand-new row into the shared tags
-- table — previously nothing but the initial seed data could do that.
create policy "admin inserts tags" on public.tags for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
-- Previously only reachable via the suggestion-approval queue (which
-- creates NEW tags) — nothing let an admin edit or remove an already-
-- real tag from the shared registry.
create policy "admin updates tags" on public.tags for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin deletes tags" on public.tags for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "public read tag groups" on public.tag_groups for select using (true);
create policy "admin add tag groups" on public.tag_groups for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin updates tag groups" on public.tag_groups for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin deletes tag groups" on public.tag_groups for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

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
-- Previously insert + delete only — a typo could only be fixed by
-- deleting and re-adding, which fails outright if the entry's already
-- in use in any proposal's decision chain.
create policy "admin updates decision makers" on public.decision_makers for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- decision_maker_profiles / decision_maker_legislation / revisions: public
-- read (these are public profiles, no login needed to view), any signed-in
-- user can create or edit (the actual wiki-editing model Samantha asked
-- for), admin keeps a delete override for cleanup. This is intentionally
-- MORE open than decision_makers' own update policy above — see the
-- comment on decision_maker_profiles in the table definition for why.
alter table public.decision_maker_profiles enable row level security;
create policy "public read decision maker profiles" on public.decision_maker_profiles
  for select using (true);
create policy "authenticated insert decision maker profiles" on public.decision_maker_profiles
  for insert to authenticated with check (true);
create policy "authenticated update decision maker profiles" on public.decision_maker_profiles
  for update to authenticated using (true);
create policy "admin deletes decision maker profiles" on public.decision_maker_profiles
  for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

alter table public.decision_maker_legislation enable row level security;
create policy "public read decision maker legislation" on public.decision_maker_legislation
  for select using (true);
create policy "authenticated add decision maker legislation" on public.decision_maker_legislation
  for insert to authenticated with check (auth.uid() = added_by);
-- Anyone can fix an entry (wiki model) — the revision log is what makes
-- this safe, not a narrower update policy.
create policy "authenticated update decision maker legislation" on public.decision_maker_legislation
  for update to authenticated using (true);
create policy "admin deletes decision maker legislation" on public.decision_maker_legislation
  for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

alter table public.decision_maker_revisions enable row level security;
create policy "public read decision maker revisions" on public.decision_maker_revisions
  for select using (true);
create policy "authenticated add decision maker revisions" on public.decision_maker_revisions
  for insert to authenticated with check (auth.uid() = edited_by);
-- No update policy at all, on purpose — a history log that could itself
-- be silently edited wouldn't be trustworthy as a history log.
create policy "admin deletes decision maker revisions" on public.decision_maker_revisions
  for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

alter table public.decision_maker_tags enable row level security;
create policy "public read decision maker tags" on public.decision_maker_tags
  for select using (true);
create policy "authenticated add decision maker tags" on public.decision_maker_tags
  for insert to authenticated with check (auth.uid() = added_by);
create policy "adder or admin removes decision maker tags" on public.decision_maker_tags
  for delete using (
    auth.uid() = added_by
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- organizations: same shape as decision_makers — open insert (added_by
-- must match the inserter), admin-only update/delete of the registry
-- row itself.
alter table public.organizations enable row level security;
create policy "public read organizations" on public.organizations for select using (true);
create policy "authenticated add organizations" on public.organizations for insert
  with check (auth.uid() = added_by);
create policy "admin updates organizations" on public.organizations for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin deletes organizations" on public.organizations for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- organization_profiles / organization_revisions: same wide-open wiki
-- model as decision_maker_profiles above.
alter table public.organization_profiles enable row level security;
create policy "public read organization profiles" on public.organization_profiles
  for select using (true);
create policy "authenticated insert organization profiles" on public.organization_profiles
  for insert to authenticated with check (true);
create policy "authenticated update organization profiles" on public.organization_profiles
  for update to authenticated using (true);
create policy "admin deletes organization profiles" on public.organization_profiles
  for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

alter table public.organization_revisions enable row level security;
create policy "public read organization revisions" on public.organization_revisions
  for select using (true);
create policy "authenticated add organization revisions" on public.organization_revisions
  for insert to authenticated with check (auth.uid() = edited_by);
create policy "admin deletes organization revisions" on public.organization_revisions
  for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- profile_organizations: you manage your OWN attachments only — public
-- read is needed so an organization's profile page can count/derive
-- "Serves # Citizen Mayors" and so your own profile page can list what
-- you've attached, but never who else has.
alter table public.profile_organizations enable row level security;
create policy "public read profile organizations" on public.profile_organizations
  for select using (true);
create policy "members attach their own organizations" on public.profile_organizations
  for insert to authenticated with check (auth.uid() = profile_id);
create policy "members remove their own organizations" on public.profile_organizations
  for delete to authenticated using (auth.uid() = profile_id);
-- Admin override for the organizations admin screen's force-delete —
-- same reasoning as the power-tree-nodes override above.
create policy "admin removes any profile organization" on public.profile_organizations
  for delete using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Same trust model as decision_makers: anyone signed in can add a grant
-- to the shared registry, but only an admin can rename or remove the
-- registry entry itself.
create policy "authenticated add grants" on public.grants for insert
  with check (auth.uid() = added_by);
create policy "admin updates grants" on public.grants for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin deletes grants" on public.grants for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- Attaching a grant to a proposal is open to anyone signed in, no
-- approval gate — it's a funding lead, not a claim made on the
-- proposal's behalf. Removing one is owner-or-admin only.
create policy "authenticated attach proposal grants" on public.proposal_grants for insert
  with check (auth.uid() = submitted_by);
create policy "owner or admin remove proposal grants" on public.proposal_grants for delete
  using (
    exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

create policy "authenticated add proposal case studies" on public.proposal_case_studies for insert
  with check (auth.uid() = submitted_by);
create policy "owner or admin remove proposal case studies" on public.proposal_case_studies for delete
  using (
    exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid())
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Deliberately different removal rule than the two policies above: the
-- SUPPORTER (or an admin) can remove a petition-support row, not the
-- proposal owner — an owner shouldn't be able to erase someone else's
-- stated support just because it's their proposal.
create policy "authenticated add petition support" on public.proposal_petition_supporters for insert
  with check (auth.uid() = user_id);
-- Wide open to insert (including anonymous — no `with check` restricting
-- who), since the whole point is someone doesn't need an account to flag
-- that something's confusing. Only an admin can read or update/delete —
-- this is a moderation inbox, not a public feed.
create policy "anyone inserts site feedback" on public.site_feedback for insert
  with check (true);
create policy "admin reads site feedback" on public.site_feedback for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin updates site feedback" on public.site_feedback for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "admin deletes site feedback" on public.site_feedback for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

create policy "supporter or admin remove petition support" on public.proposal_petition_supporters for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Anyone signed in can suggest a decision-maker for the chain, not just
-- the owner — the app layer (addPowerTreeNode) decides whether that
-- lands as 'approved' (owner) or 'pending' (everyone else).
create policy "authenticated contribute to power tree" on public.proposal_power_tree_nodes for insert
  with check (auth.role() = 'authenticated');
create policy "owner edits own power tree" on public.proposal_power_tree_nodes for delete
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));
-- Admin override, added alongside the grants/organizations admin
-- screens: without this, an admin's "force delete anyway" on an abusive
-- decision-maker entry (see admin/actions.ts forceDeleteDecisionMaker)
-- silently failed via RLS for any proposal chain the admin didn't
-- personally own — the app-level admin check isn't what actually
-- allows the write, this policy is.
create policy "admin removes any power tree node" on public.proposal_power_tree_nodes for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
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

-- Same shape as the decision-chain policies above: public read, anyone
-- signed in can insert (the app decides pending vs. approved based on
-- ownership), owner or admin can delete, and update is open to any
-- authenticated user because reindexing after an insert touches every
-- row's sort_order — the actions that need real owner-only enforcement
-- (approve, reorder, progress toggle) check ownership themselves in the
-- server action before ever touching the database.
create policy "public read proposal phases" on public.proposal_phases for select using (true);
create policy "authenticated add proposal phases" on public.proposal_phases for insert
  with check (auth.role() = 'authenticated');
create policy "owner deletes own proposal phases" on public.proposal_phases for delete
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.owner_id = auth.uid()));
create policy "admin deletes any proposal phase" on public.proposal_phases for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));
create policy "authenticated updates proposal phases" on public.proposal_phases for update
  using (auth.role() = 'authenticated');

create policy "authenticated add power_tree_node_updates" on public.power_tree_node_updates for insert
  with check (auth.uid() = author_id);

-- Civic report card / "add a log" — self-reported off-platform civic
-- actions (letters to the editor, community meetings, volunteer hours,
-- testimony, contacting an elected official). One flexible table for
-- all five types, rather than five separate tables, so a person's whole
-- log is one feed instead of a merge of five queries every time.
-- Letters to the editor and contacting an elected are deliberately kept
-- as two separate log types rather than folded together — a letter to
-- the editor reaches a public audience through local media and builds
-- outside pressure/visibility, while contacting an official is direct
-- and private; conflating them would lose the ability to see either
-- one clearly on its own.
create table public.civic_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_type text not null check (log_type in ('letter_to_editor', 'community_meeting', 'volunteer_hours', 'testimony', 'contacted_official')),
  occurred_on date not null default current_date,
  -- letter_to_editor only:
  title text,
  published boolean not null default false,
  published_link text,
  -- community_meeting: free text for now; a future iteration links this
  -- to a real organization profile (see platform-future-iterations
  -- notes). contacted_official: reused for who/which office was
  -- contacted (e.g. "Councilmember Jones' office"), same free-text idea.
  organization text,
  -- contacted_official only — how the contact happened:
  contact_method text check (contact_method is null or contact_method in ('phone', 'email', 'letter', 'in_person')),
  -- volunteer_hours only:
  hours numeric,
  category text, -- what you did (Tutoring, Environmental Conservation, ...)
  population_served text, -- who it was for, independent of category (Youth, Seniors, ...) — see population_categories above
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
-- Lets an admin's category rename (renameVolunteerCategory) bulk-update
-- the plain-text `category` column on every affected log entry,
-- regardless of who logged it — without this, that update would
-- silently touch zero rows for anyone else's logs.
create policy "admin updates any civic log" on public.civic_logs for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

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

-- ---------------------------------------------------------------------------
-- Storage: decision-maker photos + organization logos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('decision-maker-photos', 'decision-maker-photos', true)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('organization-logos', 'organization-logos', true)
on conflict (id) do nothing;

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
