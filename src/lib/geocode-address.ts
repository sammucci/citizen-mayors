// Turns a free-text address or intersection ("Frankford & Girard") into
// real coordinates, using the Census Bureau's public geocoder — free, no
// API key, and already the source the rest of this app leans on for
// Census data, so this doesn't introduce a new third-party dependency or
// a key Samantha would need to manage. Handles cross-streets fine (that's
// literally the example above — the Census geocoder matches "Frankford &
// Girard" against its street-range data and returns the intersection's
// point), which a lot of consumer geocoders don't do well.
//
// Server-only — not imported by any "use client" file, so there's no
// RSC-boundary risk (see the community-dashboard bug from earlier this
// project for why that distinction matters).
// `label` is the Census geocoder's own corrected/canonical version of
// whatever was typed — not an echo of the input. This is what fixes two
// things at once: the display used to just be whatever the person typed,
// verbatim (lowercase, abbreviated, however they happened to type it —
// "n mascher and w colona"), and a typo in a street name that still
// happened to match (the geocoder matches against real TIGER street
// data, not a strict copy of the input) used to stay a typo forever
// since nothing ever looked at what the geocoder actually resolved it
// to. Using its matched address instead of the raw input solves both:
// it's correctly spelled and cased because it's real reference data, not
// user typing. Only present when a match was actually found.
export type GeocodedPoint = { lat: number; lng: number; label: string | null };

export async function geocodeAddress(rawAddress: string): Promise<GeocodedPoint | null> {
  const trimmed = rawAddress.trim();
  if (!trimmed) return null;

  // Short addresses/intersections almost never include a city on their
  // own ("Frankford & Girard") — without it, the geocoder has no way to
  // know this means Philadelphia specifically and either fails to match
  // or matches somewhere else in the country entirely. Appending it only
  // when it's not already there handles someone who DID type a full
  // address themselves without doubling up on "Philadelphia, PA, PA".
  const address = /philadelphia/i.test(trimmed) ? trimmed : `${trimmed}, Philadelphia, PA`;

  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match?.coordinates) return null;
    const lat = Number(match.coordinates.y);
    const lng = Number(match.coordinates.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: formatMatchedAddress(match.matchedAddress) };
  } catch {
    // Timed out, network hiccup, or an unexpected response shape — none
    // of that should ever block creating or saving a proposal. Worst
    // case, this one just doesn't get a pin on the map yet; nothing about
    // the proposal itself is lost, and saving it again later will retry.
    return null;
  }
}

// Census returns matched addresses ALL CAPS and with the city/state/zip
// tacked on ("N MASCHER ST & W COLUMBIA AVE, PHILADELPHIA, PA, 19133") —
// fine for their own matching purposes, not fine to show next to a 📍 on
// this site, where Philadelphia is already a given. Strips the city/
// state/zip and title-cases what's left, word by word (which also
// happens to be exactly right for street abbreviations like "ST"/"AVE"
// and directionals like "N"/"W" — capitalize-first-letter-lowercase-rest
// turns those into "St"/"Ave"/"N"/"W" without needing a lookup table).
function formatMatchedAddress(matched: unknown): string | null {
  if (typeof matched !== "string" || !matched.trim()) return null;
  const withoutCityState = matched.replace(/,?\s*PHILADELPHIA,?\s*PA,?\s*\d{0,5}\s*$/i, "").trim();
  const source = withoutCityState || matched;
  return titleCaseAddress(source);
}

// Shared with the plain-typed-input fallback (no geocode match at all) so
// capitalization is at least improved even when there's nothing to
// correct a typo against.
export function titleCaseAddress(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split(/([&/-])/) // keep separators like "&" and "-" as their own tokens, unchanged
        .map((part) => (/[a-z]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
        .join("")
    )
    .join(" ");
}
