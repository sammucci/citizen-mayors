"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Proposal = {
  id: string;
  title: string;
  council_district: number | null;
  geography_scope: string;
  geocoded_lat: number | null;
  geocoded_lng: number | null;
  categories: { color: string | null; label: string | null } | null;
};

// Phase 2 of the map feature: an address-scope proposal now plots at its
// real geocoded point (see geocode-address.ts) instead of nowhere at
// all. A council-district-scope proposal still plots at that district's
// centroid — there's no single address to point to for "this applies to
// District 3," so a centroid remains the right representation for that
// case, not a placeholder waiting to be replaced.
//
// Shoelace-formula polygon centroid. Good enough for these single-ring
// district polygons (no holes, which is all this dataset has) — not a
// general-purpose geometry library, just enough math for this one job.
function polygonCentroid(ring: [number, number][]): [number, number] {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (twiceArea === 0) {
    // Degenerate polygon fallback — plain average of the points.
    const sum = ring.reduce((acc, [px, py]) => [acc[0] + px, acc[1] + py], [0, 0]);
    return [sum[1] / ring.length, sum[0] / ring.length];
  }
  const area = twiceArea / 2;
  return [cy / (6 * area), cx / (6 * area)]; // [lat, lng]
}

export function PhillyMap({
  proposals,
  totalCount,
  height = 500,
  fill = false,
}: {
  proposals: Proposal[];
  // Total proposals in the current filtered set, including ones with no
  // map-able location (neighborhood/zip/address/citywide) — used only to
  // caption how much of what's below is actually plotted. Optional so
  // this component still works anywhere it's used without that context.
  totalCount?: number;
  // Pixel height. Lets the same map render as a compact landing-page
  // preview (see expandable-map.tsx) or full-size inside that preview's
  // "expand" modal, without two copies of this component to keep in sync.
  // Ignored when fill is true.
  height?: number;
  // When true, the map fills 100% of its parent's height instead of a
  // fixed pixel height — used by the landing-page preview so it stretches
  // to match the featured proposal cards next to it (grid row height),
  // rather than sitting at a fixed short height regardless of how tall
  // that column ends up being. The modal ("expand map") still uses a
  // fixed height since it isn't sharing a row with anything.
  fill?: boolean;
}) {
  const [districts, setDistricts] = useState<any>(null);
  const [centroids, setCentroids] = useState<Record<string, [number, number]>>({});

  useEffect(() => {
    fetch("/philly-council-districts.geojson")
      .then((res) => res.json())
      .then((geojson) => {
        setDistricts(geojson);
        const next: Record<string, [number, number]> = {};
        for (const feature of geojson.features) {
          const ring = feature.geometry.coordinates[0] as [number, number][];
          next[feature.properties.district] = polygonCentroid(ring);
        }
        setCentroids(next);
      });
  }, []);

  const sizeClass = fill ? "h-full" : "";
  const sizeStyle = fill ? undefined : { height };

  if (!districts) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500 ${sizeClass}`}
        style={sizeStyle}
      >
        Loading map…
      </div>
    );
  }

  // Two different kinds of pin: an address-scope proposal with a real
  // geocoded point plots exactly there — no grouping or jitter needed,
  // it's an actual location. A council-district-scope proposal has no
  // single point to plot (the whole point of that scope is "applies to
  // this district," not "at this spot"), so those still group at the
  // district's centroid with jitter to keep multiple pins from stacking.
  const geocodedProposals = proposals.filter(
    (p) => p.geography_scope === "address" && p.geocoded_lat != null && p.geocoded_lng != null
  );
  const byDistrict = new Map<number, Proposal[]>();
  for (const p of proposals) {
    if (p.geography_scope !== "council_district" || !p.council_district) continue;
    const list = byDistrict.get(p.council_district) ?? [];
    list.push(p);
    byDistrict.set(p.council_district, list);
  }

  const hiddenCount = totalCount !== undefined ? totalCount - proposals.length : null;

  return (
    <div className={`relative ${sizeClass}`}>
      <MapContainer
        center={[40.0, -75.14]}
        zoom={11}
        scrollWheelZoom={false}
        className={`w-full rounded-lg border border-neutral-200 ${sizeClass}`}
        style={sizeStyle}
      >
        {/* Light-grey basemap (CartoDB Positron) instead of standard OSM
            tiles — the default OSM style is busy with labels, roads, and
            saturated colors that fight with the proposal pins for
            attention. Positron strips that down to a pale grey canvas so
            the colored pins (and the purple district outlines) are what
            actually stands out. Free, no API key. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <GeoJSON data={districts} style={{ color: "#6C3FD1", weight: 1.5, fillOpacity: 0.04 }} />
        {Array.from(byDistrict.entries()).flatMap(([district, ps]) => {
          const centroid = centroids[String(district)];
          if (!centroid) return [];
          return ps.map((p, i) => {
            // Small jitter so multiple proposals in the same district
            // don't stack exactly on top of each other — a real pin per
            // proposal is what retroactive geocoding replaces this with.
            const angle = (i / ps.length) * 2 * Math.PI;
            const radius = ps.length > 1 ? 0.01 : 0;
            const lat = centroid[0] + radius * Math.sin(angle);
            const lng = centroid[1] + radius * Math.cos(angle);
            const color = p.categories?.color ?? "#6C3FD1";
            return (
              <CircleMarker
                key={p.id}
                center={[lat, lng]}
                radius={8}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
              >
                <Popup>
                  <Link href={`/proposals/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <div className="mt-1 text-xs text-neutral-500">
                    District {district}
                    {p.categories?.label ? ` · ${p.categories.label}` : ""}
                  </div>
                </Popup>
              </CircleMarker>
            );
          });
        })}
        {/* Exact-address pins — real coordinates, no jitter needed since
            each one is an actual distinct location rather than a shared
            district centroid. A slightly larger, more solid marker than
            the district-centroid ones so an exact pin visually reads as
            more precise than an approximate one. */}
        {geocodedProposals.map((p) => {
          const color = p.categories?.color ?? "#6C3FD1";
          return (
            <CircleMarker
              key={p.id}
              center={[p.geocoded_lat as number, p.geocoded_lng as number]}
              radius={9}
              pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 2.5 }}
            >
              <Popup>
                <Link href={`/proposals/${p.id}`} className="font-medium hover:underline">
                  {p.title}
                </Link>
                <div className="mt-1 text-xs text-neutral-500">
                  {p.categories?.label ?? "Address"}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Overlaid on the map itself now, bottom-left, instead of a caption
          line living underneath it — was easy to miss as a separate
          block of text below the fold of the map; this way it reads as
          part of the map the moment you look at it. z-[500] sits above
          Leaflet's tile/marker panes (z-index up to ~400) but below the
          default zoom control (z-index 1000, top-left, so no overlap). */}
      {totalCount !== undefined && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-[500] max-w-[85%] rounded-md bg-white/85 px-2.5 py-1.5 text-[11px] leading-snug text-neutral-700 shadow-sm backdrop-blur-sm sm:max-w-xs">
          <span aria-hidden="true">📍</span> Showing {proposals.length} of {totalCount} proposal
          {totalCount === 1 ? "" : "s"} on the map — a bold pin for an exact address,
          a lighter one at the middle of a council district when that's all we have. The
          rest ({hiddenCount} located by neighborhood, zip, or citywide) only show up in
          the list below.
        </div>
      )}
    </div>
  );
}
