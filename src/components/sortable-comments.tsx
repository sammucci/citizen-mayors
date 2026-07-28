"use client";

import { useMemo, useState } from "react";
import { readableTextColor } from "@/lib/readable-text-color";

type Item = {
  id: string;
  score: number;
  createdAt: string;
  element: React.ReactNode;
};

// The actual fix for "sorting reloads the whole page" — the previous
// attempt (?sort= + Next's Link) stopped the hard browser reload, but
// missed that `sort` is read by the whole page component, not just this
// list: changing the URL still re-runs the entire server component and
// re-fetches everything on the page, which still reads as a refresh
// even without the white-flash. This sorts already-rendered comment
// elements client-side instead — no URL change, no server round-trip,
// just reordering what's already on the page.
export function SortableComments({
  items,
  categoryColor,
}: {
  items: Item[];
  categoryColor: string;
}) {
  const [sortMode, setSortMode] = useState<"oldest" | "new" | "top">("oldest");

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sortMode === "top") {
      copy.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
    } else if (sortMode === "new") {
      copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return copy;
  }, [items, sortMode]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Discussion</h2>
        <div className="flex items-center gap-1 text-xs">
          {(
            [
              ["oldest", "Oldest"],
              ["new", "Newest"],
              ["top", "Most active"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className="rounded-full px-2 py-1"
              style={
                sortMode === mode
                  ? { backgroundColor: categoryColor, color: readableTextColor(categoryColor) }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-3 space-y-4">
        {/* Each item.element is already a <li> (renderComment builds
            its own), already carrying its own key — no extra wrapper
            needed or wanted here. */}
        {sorted.map((item) => item.element)}
        {items.length === 0 && (
          <p className="text-sm text-neutral-500">No comments yet — be the first to weigh in.</p>
        )}
      </ul>
    </>
  );
}
