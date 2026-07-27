"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Category = { slug: string; label: string };
type Tag = { slug: string; label: string };

export function ProposalFilters({
  categories,
  tags,
}: {
  categories: Category[];
  tags: Tag[];
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

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <select
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        value={searchParams.get("type") ?? ""}
        onChange={(e) => updateParam("type", e.target.value)}
      >
        <option value="">All types</option>
        <option value="policy">Policy</option>
        <option value="project">Project</option>
      </select>

      <select
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        value={searchParams.get("category") ?? ""}
        onChange={(e) => updateParam("category", e.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        value={searchParams.get("district") ?? ""}
        onChange={(e) => updateParam("district", e.target.value)}
      >
        <option value="">All districts</option>
        {districts.map((d) => (
          <option key={d} value={d}>
            District {d}
          </option>
        ))}
      </select>

      <select
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        value={searchParams.get("tag") ?? ""}
        onChange={(e) => updateParam("tag", e.target.value)}
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.slug} value={t.slug}>
            #{t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
