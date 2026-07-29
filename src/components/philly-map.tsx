"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Proposal = {
  id: string;
  title: string;
  council_district: number | null;
  categories: { color: string | null; label: string | null } | null;
};

// Phase 1 of the map feature: plot proposals using location data that
// already exists (council district) rather than exact coordinates,
// which nothing collects yet. Pins sit at each district's centroid —
// not a real address — as a placeholder until proposals can be
// retroactively geocoded to real points later.
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
}: {
  proposals: Proposal[];
  // Total proposals in the current filtered set, including ones with no
  // map-able location (neighborhood/zip/address/citywide) — used only to
  // caption how much of what's below is actually plotted. Optional so
  // this component still works anywhere it's used without that context.
  totalCount?: number;
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

  if (!districts) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
        Loading map…
      </div>
    );
  }

  const byDistrict = new Map<number, Proposal[]>();
  for (const p of proposals) {
    if (!p.council_district) continue;
    const list = byDistrict.get(p.council_district) ?? [];
    list.push(p);
    byDistrict.set(p.council_district, list);
  }

  const hiddenCount = totalCount !== undefined ? totalCount - proposals.length : null;

  return (
    <div className="relative">
      <MapContainer
        center={[40.0, -75.14]}
        zoom={11}
        scrollWheelZoom={false}
        className="h-[500px] w-full rounded-lg"
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
          {totalCount === 1 ? "" : "s"} on the map. Pins sit at the middle of each council
          district for now, not an exact address — the rest ({hiddenCount} located by
          neighborhood, zip, address, or citywide) only show up in the list below.
        </div>
      )}
    </div>
  );
}
