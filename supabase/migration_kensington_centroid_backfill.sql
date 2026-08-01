-- "Kensington" (the broader neighborhood, distinct from its East/West/
-- Olde sub-areas) was a valid pick in the curated neighborhood list but
-- had no centroid entry yet in philly-neighborhood-centroids.ts, so any
-- proposal scoped to it saved with a null geocoded_lat/lng and never
-- showed up on the map — reported directly ("I chose a proposal in
-- Kensington and it is not reflected on the list"). A centroid's been
-- added to that file now, which fixes it going forward for any new or
-- edited proposal, but doesn't retroactively touch rows already sitting
-- in the database with a null point — this backfills those.
update public.proposals
set geocoded_lat = 39.9843, geocoded_lng = -75.1258
where geography_scope = 'neighborhood'
  and lower(trim(geography_label)) = 'kensington'
  and geocoded_lat is null;
