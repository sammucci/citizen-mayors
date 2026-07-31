-- Adds party affiliation to decision-maker profiles. Run this script.
-- Safe to run more than once.
alter table public.decision_maker_profiles
  add column if not exists party_affiliation text;
