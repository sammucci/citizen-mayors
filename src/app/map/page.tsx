import nextDynamicImport from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Leaflet touches window/document at import time, so it can't run
// during server rendering — loaded client-only via next/dynamic
// (imported here as nextDynamicImport since the route-config export
// below is required to be named exactly "dynamic").
const PhillyMap = nextDynamicImport(
  () => import("@/components/philly-map").then((m) => m.PhillyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
        Loading map…
      </div>
    ),
  }
);

export default async function MapPage() {
  const supabase = createClient();
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, title, geography_scope, council_district, categories ( color, label )")
    .order("created_at", { ascending: false });

  // Phase 1: plot what already exists (council district) rather than
  // real addresses, which nothing collects yet. Everything else —
  // citywide, neighborhood, zip, address — doesn't have a point to plot
  // and shows up in the list below instead, until it can be
  // retroactively geocoded to a real location.
  const onMap = (proposals ?? []).filter(
    (p: any) => p.geography_scope === "council_district" && p.council_district
  );
  const notYetLocated = (proposals ?? []).filter(
    (p: any) => !(p.geography_scope === "council_district" && p.council_district)
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Map</h1>
      <p className="mt-2 text-neutral-600">
        Proposals by council district. This is a first pass — pins sit at
        the middle of each district for now, not an exact address, since
        precise locations haven't been collected yet.
      </p>

      <div className="mt-6">
        {/* Supabase's loose typing for the embedded categories join
            infers an array shape even though it's actually a single
            object at runtime for this to-one relationship — same
            mismatch handled with `any` elsewhere in this codebase. */}
        <PhillyMap proposals={onMap as any} />
      </div>

      {notYetLocated.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Not shown on the map yet</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Citywide proposals, and ones located by neighborhood, zip, or
            address, don&apos;t have map coordinates yet.
          </p>
          <ul className="mt-3 space-y-2">
            {notYetLocated.map((p: any) => (
              <li
                key={p.id}
                className="rounded-lg border border-neutral-200 bg-white p-3 text-sm"
              >
                <Link href={`/proposals/${p.id}`} className="font-medium hover:underline">
                  {p.title}
                </Link>
                <span className="ml-2 text-xs text-neutral-500">
                  {p.geography_scope === "citywide" ? "Citywide" : p.geography_scope}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
