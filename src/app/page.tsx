import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProposalFilters } from "@/components/proposal-filters";

export const dynamic = "force-dynamic";

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

  let query = supabase
    .from("proposals")
    .select(
      `id, title, type, summary, geography_scope, geography_label, council_district, created_at,
       categories ( slug, label, color ),
       proposal_tags ( tags ( slug, label ) ),
       reactions ( value ),
       proposal_flags ( flag_type )`
    )
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

  return (
    <div>
      <h1 className="text-2xl font-semibold">If I were mayor...</h1>
      <p className="mt-2 text-neutral-600">
        Propose a policy or project for Philadelphia, and help shape everyone
        else&apos;s.
      </p>

      <div className="mt-6">
        <ProposalFilters categories={categories ?? []} tags={tags ?? []} />
        <p className="mt-1 text-xs text-neutral-400">
          District filters also include citywide proposals, since those apply
          everywhere.
        </p>
      </div>

      <ul className="mt-8 space-y-4">
        {filteredProposals.map((p: any) => {
          const score = (p.reactions ?? []).reduce(
            (sum: number, r: any) => sum + r.value,
            0
          );
          const escalateCount = (p.proposal_flags ?? []).filter(
            (f: any) => f.flag_type === "ready_to_escalate"
          ).length;

          const location =
            p.geography_scope === "citywide"
              ? "Citywide"
              : p.geography_scope === "council_district" && p.council_district
              ? `District ${p.council_district}`
              : p.geography_label ?? p.geography_scope;

          return (
            <li
              key={p.id}
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
            >
              <div
                className="h-2"
                style={{ backgroundColor: p.categories?.color ?? "#e5e5e5" }}
              />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    {p.type} · {p.categories?.label}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {score >= 0 ? `+${score}` : score} votes
                  </span>
                </div>
                <Link
                  href={`/proposals/${p.id}`}
                  className="mt-1 block text-lg font-medium hover:underline"
                >
                  {p.title}
                </Link>
                <p className="mt-1 text-sm text-neutral-600">{p.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>📍 {location}</span>
                  {p.proposal_tags?.map((pt: any) => (
                    <span key={pt.tags?.slug} className="rounded-full bg-neutral-100 px-2 py-0.5">
                      #{pt.tags?.label}
                    </span>
                  ))}
                  {escalateCount > 0 && (
                    <span className="rounded-full bg-duty-yellow px-2 py-0.5 text-neutral-900">
                      {escalateCount} flagged ready to escalate
                    </span>
                  )}
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
