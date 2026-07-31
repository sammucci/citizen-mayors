-- Adds a "current officeholder" name to decision-maker profiles, and
-- fills it in (plus "who they represent") for the seeded Mayor entry.
-- Run this script. Safe to run more than once.
alter table public.decision_maker_profiles
  add column if not exists current_officeholder text;

-- Mayor of Philadelphia is seeded as an office, not a person (see
-- schema.sql) — this is the one-time data fix for that specific row:
-- Cherelle Parker, current as of this writing, plus "citywide" since
-- the Mayor represents the whole city. If you ever need to update this
-- after an election, just use Edit on the profile page itself — this
-- script only needs to run once to set the starting values.
insert into public.decision_maker_profiles (decision_maker_id, current_officeholder, represents_scope)
select id, 'Cherelle Parker', 'citywide'
from public.decision_makers
where lower(name) = 'mayor of philadelphia'
on conflict (decision_maker_id) do update
set current_officeholder = excluded.current_officeholder,
    represents_scope = excluded.represents_scope;
