import { NextRequest, NextResponse } from "next/server";

// Nominatim (OpenStreetMap) search, proxied through our own server rather
// than called straight from the browser. Two reasons: their usage policy
// (operations.osmfoundation.org/policies/nominatim) asks for a real
// User-Agent identifying the app, which browsers won't let client JS set;
// and proxying gives every visitor's queries a shared, cached path
// instead of each browser hammering Nominatim's 1-request/second limit
// on its own.
//
// Scoped to Philadelphia via a bounding box so "Fishtown" doesn't return
// a result in Oregon.
const PHILLY_VIEWBOX = "-75.2803,40.1379,-74.9557,39.8672"; // left,top,right,bottom

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json([]);
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", PHILLY_VIEWBOX);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("q", `${q}, Philadelphia, PA`);

  let results: Array<{ display_name: string; address?: Record<string, string> }> = [];
  try {
    const res = await fetch(url, {
      headers: {
        // Contact info in the User-Agent is what Nominatim's policy asks
        // for — lets them reach us instead of just blocking the IP if
        // something's misbehaving.
        "User-Agent": "CitizenMayors/1.0 (samantha@weareombuds.com)",
      },
      next: { revalidate: 3600 }, // identical queries reuse the same cached result for an hour
    });
    if (res.ok) {
      results = await res.json();
    }
  } catch {
    return NextResponse.json([]);
  }

  // Nominatim's display_name is a full "Fishtown, Philadelphia,
  // Philadelphia County, Pennsylvania, 19125, United States" string —
  // trim to just the neighborhood-level name plus city, which is what
  // people actually expect to see in the dropdown and what should land
  // in the database.
  const suggestions = results.map((r) => {
    const a = r.address ?? {};
    const place =
      a.neighbourhood ||
      a.suburb ||
      a.quarter ||
      a.city_district ||
      a.hamlet ||
      a.village ||
      r.display_name.split(",")[0];
    return `${place}, Philadelphia`;
  });

  // De-dupe while preserving order — multiple raw Nominatim rows can
  // collapse to the same trimmed label.
  const seen = new Set<string>();
  const deduped = suggestions.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  return NextResponse.json(deduped);
}
