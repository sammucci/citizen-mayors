-- Fixes an inconsistency Samantha caught: the Mayor's entry is named for
-- the OFFICE ("Mayor of Philadelphia"), with "Cherelle Parker" stored
-- separately as decision_maker_profiles.current_officeholder — but the
-- council roster (migration_council_roster_seed.sql) seeded each member
-- with their NAME baked directly into the decision-makers entry itself
-- ("Mark Squilla (Councilmember, District 1)"). That meant a person's
-- name would print twice on their own profile page once someone also
-- filled in "current officeholder."
--
-- The office (the "seat") is the thing that should be durable and is
-- what a proposal-chain link, that seat's committees, term dates, and
-- edit history all attach to — a seat doesn't go away when someone loses
-- re-election, only who's sitting in it does. That's exactly why this is
-- structured as "rename the office in place, upsert who's currently
-- holding it" rather than "delete the old person and create a new one":
-- renaming in place keeps the same decision_makers.id, so every existing
-- proposal-chain link, piece of legislation, and revision-history entry
-- stays attached to the seat with zero cleanup. When someone new wins a
-- seat, updating current_officeholder is the only change needed — and
-- because that field already flows through decision_maker_revisions,
-- "who used to hold this seat, and when it changed" is automatically
-- preserved as a normal history entry, the same way any other edit is.
--
-- At-large seats have no official numbering (Philadelphia doesn't assign
-- one), so "Seat 1"–"Seat 7" below is our own stable tracking label, not
-- an official title — just enough for each of the 7 at-large members to
-- have a distinct, durable entry the way district members naturally do
-- by district number.
--
-- Safe to re-run: each row is matched by its OLD or NEW name, so running
-- this twice (or running it against a fresh install that only just seeded
-- the old-style names a moment ago) is a no-op the second time.

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Mark Squilla (Councilmember, District 1)', 'Councilmember, District 1', 'Mark Squilla', 1),
      ('Kenyatta Johnson (Council President, District 2)', 'Council President, District 2', 'Kenyatta Johnson', 2),
      ('Jamie Gauthier (Councilmember, District 3)', 'Councilmember, District 3', 'Jamie Gauthier', 3),
      ('Curtis Jones Jr. (Councilmember, District 4)', 'Councilmember, District 4', 'Curtis Jones Jr.', 4),
      ('Jeffery Young Jr. (Councilmember, District 5)', 'Councilmember, District 5', 'Jeffery Young Jr.', 5),
      ('Michael Driscoll (Councilmember, District 6)', 'Councilmember, District 6', 'Michael Driscoll', 6),
      ('Quetcy Lozada (Councilmember, District 7)', 'Councilmember, District 7', 'Quetcy Lozada', 7),
      ('Cindy Bass (Councilmember, District 8)', 'Councilmember, District 8', 'Cindy Bass', 8),
      ('Anthony Phillips (Councilmember, District 9)', 'Councilmember, District 9', 'Anthony Phillips', 9),
      ('Brian J. O''Neill (Councilmember, District 10)', 'Councilmember, District 10', 'Brian J. O''Neill', 10)
    ) as t(old_name, new_name, officeholder, district)
  loop
    if exists (select 1 from public.decision_makers where lower(name) in (lower(r.old_name), lower(r.new_name))) then
      update public.decision_makers set name = r.new_name
      where lower(name) in (lower(r.old_name), lower(r.new_name));

      insert into public.decision_maker_profiles (decision_maker_id, current_officeholder, represents_scope, represents_district)
      select id, r.officeholder, 'district', r.district
      from public.decision_makers
      where name = r.new_name
      on conflict (decision_maker_id) do update
      set current_officeholder = excluded.current_officeholder,
          represents_scope = excluded.represents_scope,
          represents_district = excluded.represents_district;
    end if;
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('Katherine Gilmore Richardson (Councilmember At-Large)', 'Councilmember At-Large, Seat 1', 'Katherine Gilmore Richardson'),
      ('Isaiah Thomas (Councilmember At-Large)', 'Councilmember At-Large, Seat 2', 'Isaiah Thomas'),
      ('Jim Harrity (Councilmember At-Large)', 'Councilmember At-Large, Seat 3', 'Jim Harrity'),
      ('Nina Ahmad (Councilmember At-Large)', 'Councilmember At-Large, Seat 4', 'Nina Ahmad'),
      ('Rue Landau (Councilmember At-Large)', 'Councilmember At-Large, Seat 5', 'Rue Landau'),
      ('Kendra Brooks (Councilmember At-Large)', 'Councilmember At-Large, Seat 6', 'Kendra Brooks'),
      ('Nicolas O''Rourke (Councilmember At-Large)', 'Councilmember At-Large, Seat 7', 'Nicolas O''Rourke')
    ) as t(old_name, new_name, officeholder)
  loop
    if exists (select 1 from public.decision_makers where lower(name) in (lower(r.old_name), lower(r.new_name))) then
      update public.decision_makers set name = r.new_name
      where lower(name) in (lower(r.old_name), lower(r.new_name));

      insert into public.decision_maker_profiles (decision_maker_id, current_officeholder, represents_scope, represents_district)
      select id, r.officeholder, 'citywide', null
      from public.decision_makers
      where name = r.new_name
      on conflict (decision_maker_id) do update
      set current_officeholder = excluded.current_officeholder,
          represents_scope = excluded.represents_scope,
          represents_district = excluded.represents_district;
    end if;
  end loop;
end $$;
