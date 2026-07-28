-- SUPERSEDED — do not run this file anymore. Replaced by
-- migration_real_zip_council_crosswalk.sql, which loads a real GIS
-- spatial join (actual zip and district boundary shapes intersected in
-- shapely) instead of the hand-compiled guesses below. Left in place
-- only for history; running it after the real crosswalk would
-- reintroduce these rougher guesses alongside the accurate data.
--
-- Best-effort zip -> council district data for the zip_council_districts
-- crosswalk table, which existed as an empty structure only until now.
--
-- IMPORTANT CAVEAT: this is NOT a precise GIS join (intersecting real
-- zip and district boundary shapes) — it's compiled from general public
-- knowledge of Philadelphia neighborhoods and the 2022 council district
-- map. Philadelphia council districts are legally drawn along ward
-- lines, not zip codes, and zips routinely straddle more than one
-- district — this table is many-to-many on purpose, and errs toward
-- listing a zip under every district it plausibly touches rather than
-- picking just one, so the profile conflict-check doesn't throw false
-- alarms on legitimately split zips.
--
-- What this CAN catch reliably: someone entering a zip and a district
-- that are nowhere near each other (the original bug report — 19122,
-- which is North Philadelphia near Temple, paired with District 10,
-- which is the far Northeast).
-- What this CANNOT guarantee: pixel-perfect accuracy at every boundary
-- line. If you spot a wrong pairing, it's easy to fix — just update or
-- delete the specific row for that zip.
--
-- A real GIS join (the City's own "City Council Districts" and "Zip
-- Codes" layers on OpenDataPhilly, actually intersected) would be a
-- worthwhile upgrade later if this ever needs to be authoritative.
--
-- Safe to re-run.

insert into public.zip_council_districts (zip_code, council_district) values
  ('19102', 1), ('19102', 2),
  ('19103', 2),
  ('19104', 3),
  ('19106', 1),
  ('19107', 1), ('19107', 2),
  ('19108', 1),
  ('19109', 1),
  ('19111', 10), ('19111', 6),
  ('19112', 2),
  ('19114', 10),
  ('19115', 10),
  ('19116', 10),
  ('19118', 9),
  ('19119', 8), ('19119', 9),
  ('19120', 7), ('19120', 9),
  ('19121', 5),
  ('19122', 5), ('19122', 7),
  ('19123', 1), ('19123', 5),
  ('19124', 6), ('19124', 7),
  ('19125', 1),
  ('19126', 9),
  ('19127', 4),
  ('19128', 4),
  ('19129', 4),
  ('19130', 5),
  ('19131', 3), ('19131', 4),
  ('19132', 5),
  ('19133', 7),
  ('19134', 1), ('19134', 7),
  ('19135', 6),
  ('19136', 6), ('19136', 10),
  ('19137', 6),
  ('19138', 8), ('19138', 9),
  ('19139', 3),
  ('19140', 5), ('19140', 7),
  ('19141', 8), ('19141', 9),
  ('19142', 2), ('19142', 3),
  ('19143', 2), ('19143', 3),
  ('19144', 8),
  ('19145', 2),
  ('19146', 2),
  ('19147', 1),
  ('19148', 1), ('19148', 2),
  ('19149', 6), ('19149', 10),
  ('19150', 8), ('19150', 9),
  ('19151', 3), ('19151', 4),
  ('19152', 10),
  ('19153', 2),
  ('19154', 10)
on conflict (zip_code, council_district) do nothing;
