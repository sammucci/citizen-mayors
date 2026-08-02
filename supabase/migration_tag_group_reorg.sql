-- Tag-group reorganization from the audit you asked for. Pure data
-- changes — no schema change, safe to run directly in the SQL editor,
-- and safe to re-run (the group inserts guard against duplicates, the
-- tag reassignments just set the same group_id again the second time).

-- 1) Two new groups.
insert into public.tag_groups (label)
select 'Housing' where not exists (select 1 from public.tag_groups where label = 'Housing');

insert into public.tag_groups (label)
select 'Streets & Safety' where not exists (select 1 from public.tag_groups where label = 'Streets & Safety');

-- 2) Housing gets its own group instead of sitting alone in Health &
-- Community, where it didn't really fit — enough of a topic on its own
-- to warrant room to grow (tenant protections, homeownership, zoning,
-- homelessness services, etc.).
update public.tags
set group_id = (select id from public.tag_groups where label = 'Housing')
where lower(label) = lower('Housing');

-- 3) Immigrants & Refugees (was oddly under Art & Culture) and Social
-- Inclusion (was under Mobility & Transit, no real transit connection)
-- both move to Health & Community — Immigrants & Refugees joins Seniors/
-- Youth/Children as a "who this serves" tag rather than a topic tag;
-- Social Inclusion is a general community/belonging concept that fits
-- better here than forced into transit.
update public.tags
set group_id = (select id from public.tag_groups where label = 'Health & Community')
where lower(label) in (lower('Immigrants & Refugees'), lower('Social Inclusion'));

-- 4) Mobility & Transit was really two different things under one name:
-- actual transit systems (left in place) and street design/safety
-- (split out here into Streets & Safety) — this also directly answers
-- the "too many overlapping street-safety tags" granularity complaint,
-- since they're now grouped together instead of scattered under a
-- transit-labeled group they didn't quite belong in.
update public.tags
set group_id = (select id from public.tag_groups where label = 'Streets & Safety')
where lower(label) in (
  lower('Bicycle Safety'),
  lower('Bike Lanes'),
  lower('Pedestrian Safety'),
  lower('Safe Streets'),
  lower('Safe Routes to School'),
  lower('Sidewalks'),
  lower('Raised Crosswalk')
);
