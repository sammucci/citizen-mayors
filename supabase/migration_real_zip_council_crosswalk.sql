-- Real zip-code-to-council-district crosswalk, replacing the earlier
-- best-effort/hand-compiled version (migration_zip_council_district_data.sql
-- — now superseded, do not run that one anymore).
--
-- Source of truth: OpenDataPhilly's "Zip Codes - Polygon" and "City
-- Council Districts - 2024" GeoJSON layers (Samantha downloaded both
-- directly from OpenDataPhilly and handed them over — my sandbox
-- couldn't pull the full files itself, only the catalog page listing
-- them). Every zip's polygon was intersected against every district's
-- polygon in shapely (a one-time offline join, not a live PostGIS
-- query) to get the real percentage of that zip's area inside each
-- district. Overlaps under 0.5% of the zip's area are dropped as noise
-- from tiny boundary-line mismatches between the two source datasets,
-- not real geography.
--
-- 48 zip codes, 89 zip/district pairs total (most zips are >90% inside
-- one district; a genuine handful — 19102, 19111, 19114, 19152, and a
-- few others — really do split close to evenly across two).
--
-- Adds a `overlap_pct` column (numeric, % of the zip's area in that
-- district) alongside the schema.sql change — lets the app suggest the
-- majority district for a zip instead of just flagging impossible
-- combinations.

alter table public.zip_council_districts add column if not exists overlap_pct numeric;

-- Clear out the old best-effort rows (and any prior run of this same
-- migration) before loading the real values — this file is meant to be
-- the complete, authoritative replacement, not an addition on top.
delete from public.zip_council_districts;

insert into public.zip_council_districts (zip_code, council_district, overlap_pct) values
  ('19102', 5, 59.7),
  ('19102', 2, 40.3),
  ('19103', 5, 63.59),
  ('19103', 2, 36.41),
  ('19104', 3, 99.98),
  ('19106', 1, 100.0),
  ('19107', 1, 96.58),
  ('19107', 5, 3.34),
  ('19109', 1, 87.35),
  ('19109', 2, 12.65),
  ('19111', 10, 60.52),
  ('19111', 9, 39.48),
  ('19112', 2, 100.0),
  ('19114', 6, 53.39),
  ('19114', 10, 46.6),
  ('19115', 10, 100.0),
  ('19116', 10, 100.0),
  ('19118', 8, 98.82),
  ('19118', 4, 1.18),
  ('19119', 8, 86.5),
  ('19119', 4, 13.5),
  ('19120', 9, 63.71),
  ('19120', 7, 20.14),
  ('19120', 8, 16.15),
  ('19121', 5, 66.71),
  ('19121', 4, 33.29),
  ('19122', 5, 65.93),
  ('19122', 7, 34.07),
  ('19123', 1, 57.36),
  ('19123', 5, 42.64),
  ('19124', 7, 78.65),
  ('19124', 9, 14.58),
  ('19124', 6, 6.77),
  ('19125', 1, 76.47),
  ('19125', 5, 11.97),
  ('19125', 7, 11.56),
  ('19126', 9, 92.24),
  ('19126', 8, 7.76),
  ('19127', 4, 99.98),
  ('19128', 4, 99.99),
  ('19129', 4, 98.95),
  ('19129', 8, 1.05),
  ('19130', 5, 77.12),
  ('19130', 4, 22.87),
  ('19131', 4, 96.52),
  ('19131', 3, 3.42),
  ('19132', 5, 43.48),
  ('19132', 4, 35.99),
  ('19132', 8, 20.53),
  ('19133', 7, 52.45),
  ('19133', 5, 47.55),
  ('19134', 6, 38.99),
  ('19134', 1, 32.18),
  ('19134', 7, 28.83),
  ('19135', 6, 92.43),
  ('19135', 7, 7.57),
  ('19136', 6, 100.0),
  ('19137', 6, 99.99),
  ('19138', 8, 52.78),
  ('19138', 9, 47.22),
  ('19139', 3, 71.35),
  ('19139', 4, 28.64),
  ('19140', 8, 45.25),
  ('19140', 7, 35.91),
  ('19140', 5, 18.84),
  ('19141', 8, 64.65),
  ('19141', 9, 35.35),
  ('19142', 2, 91.5),
  ('19142', 3, 8.46),
  ('19143', 3, 92.58),
  ('19143', 2, 7.39),
  ('19144', 8, 85.95),
  ('19144', 4, 14.05),
  ('19145', 2, 100.0),
  ('19146', 2, 99.98),
  ('19147', 1, 91.55),
  ('19147', 2, 8.45),
  ('19148', 1, 56.13),
  ('19148', 2, 43.87),
  ('19149', 6, 47.97),
  ('19149', 7, 36.34),
  ('19149', 9, 15.69),
  ('19150', 9, 100.0),
  ('19151', 4, 99.97),
  ('19152', 10, 52.7),
  ('19152', 6, 47.3),
  ('19153', 2, 94.15),
  ('19153', 3, 5.82),
  ('19154', 10, 99.99)
on conflict (zip_code, council_district) do update set overlap_pct = excluded.overlap_pct;
