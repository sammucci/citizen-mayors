-- v7 migration: seed the real Philadelphia City Council roster into the
-- decision-makers dropdown. Safe to re-run (relies on the existing unique
-- index on lower(name), kind — duplicates are silently skipped).
--
-- District council members + Council President, then at-large members.
-- Source: phlcouncil.com (current as of this migration).

insert into public.decision_makers (name, kind) values
  ('Mark Squilla (Councilmember, District 1)', 'elected_official'),
  ('Kenyatta Johnson (Council President, District 2)', 'elected_official'),
  ('Jamie Gauthier (Councilmember, District 3)', 'elected_official'),
  ('Curtis Jones Jr. (Councilmember, District 4)', 'elected_official'),
  ('Jeffery Young Jr. (Councilmember, District 5)', 'elected_official'),
  ('Michael Driscoll (Councilmember, District 6)', 'elected_official'),
  ('Quetcy Lozada (Councilmember, District 7)', 'elected_official'),
  ('Cindy Bass (Councilmember, District 8)', 'elected_official'),
  ('Anthony Phillips (Councilmember, District 9)', 'elected_official'),
  ('Brian J. O''Neill (Councilmember, District 10)', 'elected_official'),
  ('Katherine Gilmore Richardson (Councilmember At-Large)', 'elected_official'),
  ('Isaiah Thomas (Councilmember At-Large)', 'elected_official'),
  ('Jim Harrity (Councilmember At-Large)', 'elected_official'),
  ('Nina Ahmad (Councilmember At-Large)', 'elected_official'),
  ('Rue Landau (Councilmember At-Large)', 'elected_official'),
  ('Kendra Brooks (Councilmember At-Large)', 'elected_official'),
  ('Nicolas O''Rourke (Councilmember At-Large)', 'elected_official')
on conflict (lower(name), kind) do nothing;
