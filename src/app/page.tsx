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
const PhillyMap = nextDynamicImport(
  () => import("@/components/philly-map").then((m) => m.PhillyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
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

  const filteredProposals = searchParams.tag
    ? (proposals ?? []).filter((p: any) =>
        p.proposal_tags?.some((pt: any) => pt.tags?.slug === searchParams.tag)
      )
    : proposals ?? [];

  // A proposal plots on the map if it has either a council district
  // (centroid fallback) or real geocoded coordinates (an address that
  // was successfully matched by the Census geocoder — see
  // geocode-address.ts). Respects whatever filters are active, so the
  // map and the grid below always show the same set.
  const onMap = filteredProposals.filter(
    (p: any) =>
      (p.geography_scope === "council_district" && p.council_district) ||
      (p.geography_scope === "address" && p.geocoded_lat != null && p.geocoded_lng != null)
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">If I were mayor...</h1>
      <p className="mt-2 text-neutral-600">
        Propose a policy or project for Philadelphia, and help shape everyone
        else&apos;s.
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
        <ProposalFilters categories={categories ?? []} tags={tags ?? []} />
        <p className="mt-1 text-xs text-neutral-400">
          District filters also include citywide proposals, since those apply
          everywhere.
        </p>
      </div>

      <div className="mt-6">
        {/* Supabase's loose typing for the embedded categories join infers
            an array shape even though it's actually a single object at
            runtime for this to-one relationship — same mismatch handled
            with `any` elsewhere in this codebase. */}
        {/* Caption now lives overlaid on the map itself (bottom-left
            corner, semi-transparent) instead of as a separate line of
            text underneath — see philly-map.tsx. */}
        <PhillyMap proposals={onMap as any} totalCount={filteredProposals.length} />
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProposals.map((p: any) => {
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
                  color cue at a glance. */}
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

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.proposal_tags?.map((pt: any) => (
                    <span key={pt.tags?.slug} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      #{pt.tags?.label}
                    </span>
                  ))}
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
        })}
        {filteredProposals.length === 0 && (
          <li className="text-neutral-500">
            No proposals yet — be the first mayor.
          </li>
        )}
      </ul>
    </div>
  );
}
