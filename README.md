# Citizen Mayors (working name) — v1.1

If I were mayor of Philadelphia: propose a policy or project, let other
residents comment, suggest edits, and support it, and see who'd actually have
to decide it.

## What changed in this round

- Copy fix: "If I were mayor, I'd..." throughout (was "you'd").
- The new-proposal form is now interactive: picking "Citywide" hides the
  location field entirely, picking "Council district" shows a clean 1–10
  dropdown instead of free text, and zip/neighborhood/address each show only
  the relevant field.
- Proposals now store a structured `council_district` (1–10), separate from
  a person's own profile — someone can propose something for a district they
  don't live in. Citywide proposals aren't tied to one district; they're
  treated as applying to all of them, so filtering by any district also
  surfaces citywide proposals.
- Zip-code proposals auto-populate their council district when the zip
  maps to exactly one district in the `zip_council_districts` table. That
  table needs real data loaded (see below) before this actually does
  anything — it's wired up and ready, but empty until then. Address and
  neighborhood entries don't have a reliable auto-lookup yet for the same
  reason.
- Turnstile is now actually wired into the sign-in form (previously the
  supporting pieces existed but weren't connected — my mistake, fixed).
- Pulled a color palette from the CommonDuty logo (cream background, and
  red/purple/blue/yellow accents) into buttons, links, and badges.

## If the category dropdown is empty on the "new proposal" page

That page will now show a warning banner directly on the page if this
happens, but the cause is almost always the same: `supabase/schema.sql`
hasn't been run yet (or didn't finish) in the Supabase SQL Editor for this
project. To check: open the Supabase dashboard → Table Editor → look for a
`categories` table with 7 rows. If it's missing or empty, paste the full
contents of `supabase/schema.sql` into SQL Editor → Run, then refresh the
site.

## Deferred to a fast-follow (still true from before)

- Map-based geography (dropping a pin / drawing a polygon) — the database
  columns already exist for this.
- Populating `zip_council_districts` for real, from Census ZCTA boundaries
  intersected with OpenDataPhilly's
  ["City Council Districts"](https://opendataphilly.org/datasets/city-council-districts/)
  layer — needed for zip auto-population to actually work, and for the
  "is this plausible" check on a person's own self-reported district.
- "Department pressure" dashboard, karma points, district digests, and the
  CommonDuty tie-in — all still queued up, not built yet.

## Applying this update

Since you already have this project cloned, committed, and deployed: copy
everything from this folder into your existing local project folder
(overwriting what's there), then in GitHub Desktop you'll see only the
actual changed files listed — write a commit message, Commit to main, Push
origin. Vercel will pick up the push and redeploy automatically.

You'll also need to run one small additional script in the Supabase SQL
Editor: `supabase/migration_002_council_district.sql`. This adds the new
`council_district` column and the `zip_council_districts` table without
touching anything you already have — do **not** re-paste the full
`schema.sql`, since it would fail trying to re-insert categories and tags
that already exist.

If you haven't run the original `supabase/schema.sql` at all yet (the empty
category dropdown issue), run that first, then you don't need the migration
file — the fresh schema.sql already includes everything.

## Verification done so far

- `npm run typecheck` (TypeScript) passes cleanly.
