-- Real address geocoding for the proposal map. Plain lat/lng columns
-- rather than using the existing geography_point PostGIS column: that
-- column has been sitting unused since it was first added for a future
-- "drop a pin on a map" feature, and reading a PostGIS geography value
-- back out through Supabase's REST layer needs either a database view
-- or an RPC function to convert it to something JS can use directly —
-- unnecessary complexity for what's needed here. Plain doubles are just
-- returned as plain numbers, no conversion required.
--
-- Safe to run more than once.
alter table public.proposals add column if not exists geocoded_lat double precision;
alter table public.proposals add column if not exists geocoded_lng double precision;
