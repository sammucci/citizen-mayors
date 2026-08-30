"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Category = { slug: string; label: string };
type Tag = { slug: string; label: string };

// The browser's own dropdown arrow used to sit flush against the
// select's right edge with no breathing room, and looked like a plain
// unstyled form control next to everything else on the homepage that's
// deliberately designed. `appearance-none` strips it; this custom
// chevron gets real margin from the edge and matches the app's
// neutral/purple palette instead of whatever the OS defaults to.
function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        className="appearance-none rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-8 text-sm text-neutral-700 shadow-sm transition hover:border-neutral-400 focus:border-duty-purple focus:outline-none focus:ring-1 focus:ring-duty-purple"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
      >
        <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function ProposalFilters({
  categories,
  tags,
  hasPetitionFilter,
}: {
  categories: Category[];
  tags: Tag[];
  // Only the homepage passes this — a plain boolean flag rather than
  // making every caller of this shared component pass petition data it
  // doesn't have.
  hasPetitionFilter?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const districts = Array.from({ length: 10 }, (_, i) => i + 1);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/?${params.toString()}`);
  }

  const petitionActive = searchParams.get("petition") === "1";

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <FilterSelect value={searchParams.get("type") ?? ""} onChange={(v) => updateParam("type", v)}>
        <option value="">All types</option>
        <option value="policy">Policy</option>
        <option value="project">Project</option>
      </FilterSelect>

      <FilterSelect
        value={searchParams.get("category") ?? ""}
        onChange={(v) => updateParam("category", v)}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        value={searchParams.get("district") ?? ""}
        onChange={(v) => updateParam("district", v)}
      >
        <option value="">All districts</option>
        {districts.map((d) => (
          <option key={d} value={d}>
            District {d}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect value={searchParams.get("tag") ?? ""} onChange={(v) => updateParam("tag", v)}>
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.label}
          </option>
        ))}
      </FilterSelect>

      {hasPetitionFilter && (
        <button
          type="button"
          onClick={() => updateParam("petition", petitionActive ? "" : "1")}
          aria-pressed={petitionActive}
          className={
            petitionActive
              ? "rounded-md bg-duty-purple px-3 py-2 text-sm font-semibold text-white shadow-sm"
              : "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm transition hover:border-neutral-400"
          }
        >
          📣 Active petitions
        </button>
      )}
    </div>
  );
}
