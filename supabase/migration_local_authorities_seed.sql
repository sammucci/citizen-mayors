-- Seeds local Philadelphia quasi-public authorities and bodies into the
-- decision-makers dropdown that come up constantly in real land-use,
-- waterfront, and neighborhood-development proposals but weren't in the
-- original seed list (which only covered elected officials + core city
-- departments) — Samantha specifically asked for DRWC, the Land Bank,
-- and RCOs. Safe to re-run: relies on the same unique index on
-- lower(name), kind as migration_council_roster_seed.sql, so duplicates
-- are silently skipped.
--
-- "Registered Community Organization (RCO)" is deliberately one generic
-- entry, not a list of every individual neighborhood RCO in the city —
-- there are dozens of these (one per registered civic/neighborhood
-- association), and the point here is to have a stand-in for "this
-- proposal needs to go through the local RCO's zoning/land-use review,"
-- not to maintain the full citywide RCO roster. If that turns out to be
-- worth doing precisely later, it can grow into named individual RCOs
-- the same way the city council roster did.

insert into public.decision_makers (name, kind) values
  ('Delaware River Waterfront Corporation (DRWC)', 'board_commission'),
  ('Philadelphia Land Bank', 'board_commission'),
  ('Registered Community Organization (RCO)', 'other'),
  ('Philadelphia Redevelopment Authority (PRA)', 'board_commission'),
  ('Philadelphia Housing Authority (PHA)', 'board_commission'),
  ('Philadelphia Historical Commission', 'board_commission'),
  ('Philadelphia Art Commission', 'board_commission'),
  ('Department of Licenses & Inspections (L&I)', 'department'),
  ('Philadelphia Water Department', 'department'),
  ('SEPTA', 'board_commission')
on conflict (lower(name), kind) do nothing;
