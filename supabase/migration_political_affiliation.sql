-- Adds an optional, self-reported political affiliation field to profiles
-- — same treatment as the existing demographic fields (age_range,
-- race_ethnicity, gender, housing_status): never required, never shown
-- next to a person's name or on their public profile (/u/[id]), only
-- ever surfaced as an aggregate count on the community dashboard. The
-- point is being able to show that support for quality-of-life proposals
-- isn't confined to one party. Safe to re-run.
alter table public.profiles add column if not exists political_affiliation text;
