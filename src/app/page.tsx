import Link from "next/link";
import nextDynamicImport from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { ProposalFilters } from "@/components/proposal-filters";

export const dynamic = "force-dynamic";

// Leaflet touches window/document at import time, so it can't run during
// server rendering — loaded client-only via next/dynamic (imported here
// as nextDynamicImport since the route-config export above is required
// to be named exactly "dynamic"). Was its own /map page; merged onto the
// dashboard instead so there's one view of the same proposals, not two.
// Loads ExpandableMap (a compact preview + "expand to full map" modal)
// instead of PhillyMap directly now, so the map takes up less of the
// landing page above the fold, per request.
const ExpandableMap = nextDynamicImport(
  () => import("@/components/expandable-map").then((m) => m.ExpandableMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg border-2 border-duty-purple/40 bg-neutral-50 text-sm text-neutral-500 lg:min-h-[520px]">
        Loading map…
      </div>
    ),
  }
);

type SearchParams = {
  type?: string;
  category?: string;
  tag?: string;
  district?: string;
  petition?: string;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();

  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("tags").select("*").order("label"),
  ]);

  // categories!inner forces an actual inner join, which is what makes the
  // .eq("categories.slug", ...) filter below exclude non-matching proposals
  // entirely. Without "!inner", Postgrest treats categories as an optional
  // left join — the filter just nulled out the categories field on
  // non-matching rows instead of removing them, which is why the category
  // filter used to grey cards out instead of actually filtering the list.
  let query = supabase
    .from("proposals")
    .select(
      `id, title, type, summary, geography_scope, geography_label, council_district, geocoded_lat, geocoded_lng, created_at, image_url, image_position_x, image_position_y,
       categories!inner ( slug, label, color ),
       proposal_tags ( tags ( slug, label ) ),
       reactions ( value )`
    )
    // Unpublished proposals are drafts — visible to their owner on their
    // own profile/proposal page, but never here. Without this filter,
    // anyone's in-progress draft (even an empty-summary title-only one,
    // now that drafts only require a title) would show up in the public
    // grid, which is misleading since it hasn't actually been submitted.
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (searchParams.type) query = query.eq("type", searchParams.type);
  if (searchParams.category)
    query = query.eq("categories.slug", searchParams.category);

  // A citywide proposal counts toward every council district, since it
  // applies everywhere — so filtering by District 3 should surface both
  // District-3-specific proposals AND citywide ones.
  if (searchParams.district) {
    query = query.or(
      `council_district.eq.${Number(searchParams.district)},geography_scope.eq.citywide`
    );
  }

  const { data: proposals } = await query;

  // Which proposals have an active petition (a phase named for a
  // petition, approved, and marked done — i.e. actually launched, not
  // just suggested or still in progress). Fetched separately rather than
  // pushed into the proposals query above since Postgrest can't filter
  // a parent row by a related child row's field without a view/RPC —
  // same reason the tag filter below is also applied client-side after
  // the initial fetch, not in the query itself.
  const { data: allPhases } = await supabase
    .from("proposal_phases")
    .select("proposal_id, label, status, progress");
  const activePetitionProposalIds = new Set(
    (allPhases ?? [])
      .filter((p) => /petition/i.test(p.label) && p.status === "approved" && p.progress === "done")
      .map((p) => p.proposal_id)
  );

  let filteredProposals = searchParams.tag
    ? (proposals ?? []).filter((p: any) =>
        p.proposal_tags?.some((pt: any) => pt.tags?.slug === searchParams.tag)
      )
    : proposals ?? [];

  if (searchParams.petition === "1") {
    filteredProposals = filteredProposals.filter((p: any) => activePetitionProposalIds.has(p.id));
  }

  // A proposal plots on the map if it has either a council district
  // (centroid fallback), real geocoded coordinates (an address that was
  // successfully matched by the Census geocoder — see geocode-address.ts),
  // or a neighborhood that matched the curated centroid list (see
  // geocode-neighborhood.ts — same "representative point, not an exact
  // location" idea as a district centroid). Respects whatever filters
  // are active, so the map and the grid below always show the same set.
  const onMap = filteredProposals.filter(
    (p: any) =>
      (p.geography_scope === "council_district" && p.council_district) ||
      ((p.geography_scope === "address" || p.geography_scope === "neighborhood") &&
        p.geocoded_lat != null &&
        p.geocoded_lng != null)
  );

  // The newest 2 proposals sit up top next to the map so there's actually
  // something to look at above the fold; the rest of the list below picks
  // up right where that leaves off, so nothing appears twice.
  const featuredProposals = filteredProposals.slice(0, 2);
  const restProposals = filteredProposals.slice(2);

  return (
    <div>
      <h1 className="text-2xl font-semibold">If I were mayor...</h1>
      <p className="mt-2 text-neutral-600">
        What would you do if you were mayor? Propose a policy or project for
        Philadelphia, and help shape everyone else&apos;s!
      </p>

      {/* The real, prominent call to action — the header's "New
          proposal" pill is there for when you're on some other page,
          but this is the front-and-center version for the dashboard
          itself, per your ask ("fun, not just a menu item"). */}
      <Link
        href="/proposals/new"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-duty-purple px-6 py-3 text-base font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:opacity-90"
      >
        <span aria-hidden="true">🎉</span> Submit your proposal
      </Link>

      <div className="mt-6">
        <ProposalFilters categories={categories ?? []} tags={tags ?? []} hasPetitionFilter />
        <p className="mt-1 text-xs text-neutral-400">
          District filters also include citywide proposals, since those apply
          everywhere.
        </p>
      </div>

      {/* Back to the original shared-row layout (the top-right "corner"
          version didn't land) — map + first proposals share the same
          invisible 3-column grid as the proposal list below
          (lg:grid-cols-3), so column edges line up across the whole page.
          The map takes 2 of the 3 columns, the featured cards stack in
          the 3rd.
          Tried a hard fixed map height + relying on card content caps
          (144px image, 3-tag cap, 2-line summary clamp) to keep cards
          from ever outgrowing it — a long uncapped title, wrapped tags,
          or a wrapped address line can still add up to more than "2
          cards tall," which kept leaving a real gap under the map. Gone
          back to the map actually responding to the cards instead: this
          row uses the grid's default stretch (map column left alone, no
          self-start/self-stretch override), and only the CARDS column
          opts out with self-start so a short card still doesn't get
          pulled tall with dead space at ITS bottom — same bug this
          fixed the first time around. expandable-map.tsx's wrapper is
          min-height, not a hard height, so stretch can grow it past the
          floor when the cards run longer; PhillyMap's "fill" (h-full)
          mode is what lets it actually fill however tall that ends up
          being, so growing taller just shows more map, never a gap.
          Below lg, there's no row to share, so the map gets its own line
          at its floor height instead. */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Supabase's loose typing for the embedded categories join infers
              an array shape even though it's actually a single object at
              runtime for this to-one relationship — same mismatch handled
              with `any` elsewhere in this codebase. */}
          {/* Caption lives behind a small (i) icon overlaid on the map
              (bottom-left corner) instead of static text — see
              philly-map.tsx. */}
          <ExpandableMap proposals={onMap as any} totalCount={filteredProposals.length} />
        </div>
        <div className="grid grid-cols-1 gap-5 self-start">
          {featuredProposals.map((p: any) => renderProposalCard(p))}
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {restProposals.map((p: any) => renderProposalCard(p))}
        {filteredProposals.length === 0 && (
          <li className="text-neutral-500">
            No proposals yet — be the first mayor.
          </li>
        )}
      </ul>
    </div>
  );

  // Shared card markup for both the featured pair up top and the full
  // grid below it, so the two spots can't drift apart in styling.
  function renderProposalCard(p: any) {
    const score = (p.reactions ?? []).reduce(
      (sum: number, r: any) => sum + r.value,
      0
    );

    const location =
      p.geography_scope === "citywide"
        ? "Citywide"
        : p.geography_scope === "council_district" && p.council_district
        ? `District ${p.council_district}`
        : p.geography_label ?? p.geography_scope;

    return (
      <li
        key={p.id}
        className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white"
      >
        {/* The color strip now always shows, image or not — it was
            getting replaced entirely by the cover image before,
            which meant cards with an image lost their category
            color cue at a glance. Wrapped in `relative` so the active-
            petition badge (below) can sit pinned to its top-right
            corner — previously it sat in the white text area, right on
            top of the category pill, which is the actual clutter you
            flagged. */}
        <div className="relative">
          <div
            className="h-2"
            style={{ backgroundColor: p.categories?.color ?? "#e5e5e5" }}
          />
          {p.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image_url}
              alt=""
              className="h-36 w-full object-cover"
              style={{
                objectPosition: `${p.image_position_x ?? 50}% ${p.image_position_y ?? 50}%`,
              }}
            />
          )}
          {activePetitionProposalIds.has(p.id) && (
            // Bigger and brand-red now, not the same purple as the
            // category pill right below it — this needs to read as an
            // urgent "act on this" flag at a glance, not blend in as
            // just another label on the card.
            <span className="absolute right-2 top-4 inline-flex items-center gap-1 rounded-full bg-duty-red px-2.5 py-1 text-xs font-bold text-white shadow-md">
              📣 Active petition
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/?category=${p.categories?.slug ?? ""}`}
              className="rounded-full px-2 py-0.5 text-xs font-medium text-neutral-700 hover:underline"
              style={{ backgroundColor: `${p.categories?.color ?? "#e5e5e5"}33` }}
            >
              {p.categories?.label}
            </Link>
            <span className="text-xs uppercase tracking-wide text-neutral-400">
              {p.type}
            </span>
          </div>
          <Link
            href={`/proposals/${p.id}`}
            className="mt-2 block text-base font-semibold leading-snug hover:underline"
          >
            {p.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{p.summary}</p>

          {/* Capped at 3 chips + a "+N more" — a proposal with a lot of
              tags used to just wrap onto as many lines as it took, which
              could balloon a single card way past its neighbors' height
              (and, on the shared map/cards row above, past the map's own
              fixed height too, leaving a big empty gap beneath it before
              the next row started). Full tag list is still one click
              away on the proposal's own page — this is just the compact
              card. */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(p.proposal_tags ?? []).slice(0, 3).map((pt: any) => (
              <span key={pt.tags?.slug} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                #{pt.tags?.label}
              </span>
            ))}
            {(p.proposal_tags?.length ?? 0) > 3 && (
              <span className="rounded-full bg-neutral-50 px-2 py-0.5 text-xs text-neutral-400">
                +{p.proposal_tags.length - 3} more
              </span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 text-xs text-neutral-500">
            <span>📍 {location}</span>
            <span className="font-medium text-neutral-700">
              {score >= 0 ? `+${score}` : score} votes
            </span>
          </div>
        </div>
      </li>
    );
  }
}
