# Citizen Mayors v60

No new migration this time — every change is either a code-level fix or a data update to a file that isn't a database table.

## Census data — refreshed for real this time

Last version flagged (rather than faked) that the Census Bureau's 2020-2024 ACS 5-year estimates were newer than the 2022 data the community dashboard's comparison used. That refresh is done now:

- Pulled Philadelphia's 408 census tract boundaries fresh from the Census Bureau's TIGERweb service, and the 2020-2024 ACS5 tables (race/ethnicity, sex, housing tenure) from the Census API.
- Re-ran the same tract-centroid-vs-district-polygon spatial join described in `census-district-demographics.ts` — every one of the 408 tracts matched to one of the 10 council districts, then summed.
- Sanity check: the city-wide total across all 10 districts comes out to 1,579,706, which lines up with Philadelphia's actual population — a good sign the join worked correctly.
- `census-district-demographics.ts` and the community dashboard's tooltips/copy now say "2020-2024 ACS5" instead of "2022."

## Draft proposals were leaking into public views — fixed

Found this while looking at something else, and it's the kind of thing that erodes trust fast: unpublished draft proposals (including now-title-only drafts, since v59 relaxed that requirement) were showing up in two places they should never appear —

- **The homepage proposal grid** — anyone visiting the site could see everyone's in-progress drafts, not just published proposals.
- **Public profile pages (`/u/[id]`)** — same issue; a resident's drafts were visible to any visitor, which directly contradicted that page's own "only shows what's already public" design.

Both queries now filter on `published = true`. Drafts are only ever visible to their owner (on their own profile/proposal page), same as before v59's validation change — this just closes a gap that opened up once drafts became easier to create and leave unfinished.

## Report card export — cleaner proposal formatting

The "Proposals made" list in the exported civic report card (PNG/JPG/PDF) now shows each proposal as a bold title next to a smaller uppercase grey tag like `POLICY · CITYWIDE` (type + district or "Citywide"), instead of a bulleted "Title — Policy · Citywide" line. Comments made is unchanged, since its sublabel means something different there (which proposal it was posted on, not a type/location tag).

## Still open

- Decision-maker profiles — next up; you're compiling the info fields for these.
- Organization profiles, events calendar, enhanced map geocoding, translation — prioritized but not started.
