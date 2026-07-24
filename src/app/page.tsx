import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = {
  type?: string;
  category?: string;
  tag?: string;
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
      `id, title, type, summary, geography_scope, geography_label, created_at,
       categories ( slug, label ),
       proposal_tags ( tags ( slug, label ) ),
       reactions ( value ),
       proposal_flags ( flag_type )`
    )
    .order("created_at", { ascending: false });

  if (searchParams.type) query = query.eq("type", searchParams.type);
  if (searchParams.category)
    query = query.eq("categories.slug", searchParams.category);

  const { data: proposals } = await query;

  const filteredProposals = searchParams.tag
    ? (proposals ?? []).filter((p: any) =>
        p.proposal_tags?.some((pt: any) => pt.tags?.slug === searchParams.tag)
      )
    : proposals ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold">If you were mayor...</h1>
      <p className="mt-2 text-neutral-600">
        Propose a policy or project for Philadelphia, and help shape everyone
        else&apos;s.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <FilterLink
          label="All types"
          href="/"
          active={!searchParams.type && !searchParams.category}
        />
        <FilterLink
          label="Policies"
          href="/?type=policy"
          active={searchParams.type === "policy"}
        />
        <FilterLink
          label="Projects"
          href="/?type=project"
          active={searchParams.type === "project"}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {categories?.map((c) => (
          <FilterLink
            key={c.slug}
            label={c.label}
            href={`/?category=${c.slug}`}
            active={searchParams.category === c.slug}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
        {tags?.map((t) => (
          <FilterLink
            key={t.slug}
            label={`#${t.label}`}
            href={`/?tag=${t.slug}`}
            active={searchParams.tag === t.slug}
          />
        ))}
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

          return (
            <li key={p.id} className="rounded-lg border border-neutral-200 bg-white p-4">
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
                <span>
                  📍 {p.geography_label ?? p.geography_scope}
                </span>
                {p.proposal_tags?.map((pt: any) => (
                  <span key={pt.tags?.slug} className="rounded-full bg-neutral-100 px-2 py-0.5">
                    #{pt.tags?.label}
                  </span>
                ))}
                {escalateCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                    {escalateCount} flagged ready to escalate
                  </span>
                )}
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

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
      }`}
    >
      {label}
    </Link>
  );
}
