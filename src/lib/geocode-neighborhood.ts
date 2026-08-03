import { PHILLY_NEIGHBORHOODS } from "@/lib/philly-neighborhoods";
import { PHILLY_NEIGHBORHOOD_CENTROIDS } from "@/lib/philly-neighborhood-centroids";

// Matches whatever was typed/picked into the neighborhood field against
// the canonical PHILLY_NEIGHBORHOODS list, case-insensitively — so
// "point breeze", "Point breeze", and "POINT BREEZE" all resolve to the
// exact same stored value ("Point Breeze"), instead of three different
// strings that all mean the same neighborhood but never match each
// other in a filter or a count. This is the "entered with uniformity"
// half of the ask. Returns the ORIGINAL (trimmed) input unchanged if it
// doesn't match anything in the list — the field's own free-typed
// fallback for a real neighborhood that just isn't in the curated list
// yet still works, it just won't get normalized casing or a map pin.
export function canonicalizeNeighborhoodName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const match = PHILLY_NEIGHBORHOODS.find((n) => n.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

// The geocoding half: a neighborhood has no single address, so like a
// council district it plots at a representative point rather than an
// exact location (see PHILLY_NEIGHBORHOOD_CENTROIDS) — this is what
// actually gets a neighborhood-scope proposal onto the map at all, which
// it couldn't do before (the neighborhood field was always just a name
// with no coordinates attached anywhere in the app).
// `label: null` always — a neighborhood centroid isn't a "matched
// address" the way the Census geocoder returns one, there's nothing to
// prefer over the typed name. Shaped to match geocodeAddress's
// GeocodedPoint exactly (same three keys) so that in actions.ts, where a
// proposal's geocoded result can come from either function depending on
// its geography_scope, TypeScript sees one consistent type instead of a
// union where `.label` only exists on one branch — that mismatch is
// exactly what broke the last two production builds (Vercel caught it,
// a local `npm run build` would have too).
export function geocodeNeighborhood(canonicalName: string): { lat: number; lng: number; label: null } | null {
  const centroid = PHILLY_NEIGHBORHOOD_CENTROIDS[canonicalName];
  if (!centroid) return null;
  return { lat: centroid[0], lng: centroid[1], label: null };
}
