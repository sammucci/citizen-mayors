# Citizen Mayors (working name) — v1

If you were mayor of Philadelphia: propose a policy or project, let other
residents comment, suggest edits, and support it, and see who'd actually have
to decide it.

This is a first version, built to get something real in front of Samantha —
expect it to go through many more rounds.

## What's in this pass

- Accounts via Supabase Auth: magic-link email (no password) or Google
  sign-in. Anyone can browse without an account; posting, commenting, and
  voting require a verified sign-in.
- Post a **policy** or **project** proposal with a category (aligned to
  Philly's real budget categories, plus a non-budgetary "Governance and Civic
  Process" category) and citizen-friendly tags.
- Comments, including **suggested edits** (a comment with proposed
  replacement language) that the proposal owner can accept / reject / accept
  with contingency — with a note and open dialogue in the thread either way.
- The owner advances the proposal to a new version on their own timeline
  (no consensus-gating, no auto-rewrite by AI) — every past version is kept,
  and anyone can flag a resolved comment as "still not addressed" on the new
  version without blocking it.
- Upvote / downvote on proposals.
- Two crowdsourced escalation flags — "ready to bring to officials" and
  "needs legal/policy help" — visible counts only, nothing auto-sent
  anywhere. These are meant to surface proposals for Samantha (or a future
  partner) to review ahead of scheduled council conversations, not to
  trigger anything automatically.
- A decision-making / power tree per proposal, built from a shared,
  crowdsourced registry of decision-makers (elected officials, departments,
  boards) with autocomplete and an "add new" path, so "City Council" doesn't
  get retyped and misspelled on every post.
- Filtering by type, category, and tag.
- Geography entered as text for now (address / neighborhood / council
  district / zip code label) — see "Deferred to a fast-follow" below for the
  map version.
- Cloudflare Turnstile wired in on the sign-in flow (invisible to most real
  visitors) to cut down on bot signups.

Categories and tags are stored as database rows, not hardcoded in the app,
so you can add, rename, or reorganize them without a redeploy.

## Deferred to a fast-follow (on purpose, not forgotten)

- **Map-based geography**: dropping a pin or drawing a polygon, and storing
  it as real point/polygon data for heat-mapping. The database is already
  built for this (`geography_point`, `geography_polygon` columns using
  PostGIS) — the text-only version shipped first to keep v1 simpler.
- **Council district auto-suggestion + plausibility check**: letting someone
  enter a zip code and have their likely council district(s) suggested,
  without ever asking for a home address — and flagging an implausible
  self-report (e.g., a 19122 zip claiming District 1). The `zip_council_districts`
  table is in the schema for this; it needs to be populated once from two
  free public datasets — Census ZCTA boundaries and OpenDataPhilly's
  ["City Council Districts"](https://opendataphilly.org/datasets/city-council-districts/)
  layer — intersected in PostGIS. Real next step, not built yet.
- **"Department pressure" view**: since every proposal's power tree already
  links to a shared decision-maker, a dashboard showing which departments
  show up most often (and cross-referencing that against their real
  neighborhood engagement) is a query away once there's enough real data to
  make it meaningful — no new schema needed.
- **Karma / government-hero points** for real-world engagement (talking to
  an elected official, confirming your council district, etc.) — flagged by
  Samantha as a next-iteration idea, not v1.
- **District digests** for possible co-publication with a news outlet, and
  the CommonDuty tie-in (surfacing "this is soaring" proposals to real
  citizen writers rather than auto-generating anything under a byline).

## Setup

### 1. Create a new, separate Supabase project

This is fully isolated from the Meantime project — different URL, different
keys, nothing shared.

1. supabase.com → **New project** → name it (e.g. `citizen-mayors`) → pick a
   region → set a database password (save it somewhere).
2. Once it's provisioned, go to **SQL Editor** → paste in the contents of
   `supabase/schema.sql` from this repo → **Run**.
3. Go to **Project Settings → API** → copy the **Project URL** and the
   **anon public** key.
4. Go to **Authentication → Providers** → enable **Email** (magic link is on
   by default) and **Google** (you'll need a Google OAuth client ID/secret —
   happy to walk through that step when you're ready).

### 2. Create a new, separate Vercel project

1. Push this folder to a **new** GitHub repo (not the Meantime one).
2. vercel.com → **Add New → Project** → import that new repo. This creates a
   completely separate Vercel project with its own domain and environment
   variables.
3. In the new Vercel project's **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (from
     Cloudflare's dashboard → Turnstile → Add site; free, no limit)
4. Deploy. You'll get a free `*.vercel.app` URL to start — connecting
   CommonDuty's domain can happen later, whenever that's ready.

### 3. Run it locally (optional, to preview before deploying)

```
npm install
cp .env.example .env.local   # then fill in the Supabase + Turnstile values
npm run dev
```

## Verification done so far

- `npm run typecheck` (TypeScript) passes cleanly.
- `npm run lint` didn't complete cleanly in the sandbox this was built in —
  a partial/interrupted dependency install left some mismatched nested
  package versions. This is an install artifact, not a known issue with the
  code itself. Please run `npm install && npm run lint` fresh once this is
  in your own environment, and treat that as the real check before your
  first deploy.
