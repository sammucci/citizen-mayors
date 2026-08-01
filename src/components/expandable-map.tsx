"use client";

import { useEffect, useState } from "react";
import { PhillyMap } from "./philly-map";

// The map used to always render at a fixed 500px, full width, above the
// entire proposal list — meant scrolling past it before seeing even the
// first project. This wraps the same PhillyMap in a shorter "preview"
// that sits next to the first couple of proposal cards instead of above
// all of them (see the landing page layout), with a button that opens
// the exact same map full-size in a modal — so browsing pins in detail
// is still one click away, not gone.
//
// The preview stretches to fill its grid row (fill, via lg:h-full) so it
// matches however tall the two featured cards next to it end up being,
// instead of sitting at a fixed short height regardless of that —
// Samantha's report of "the map is still super short" was this exact
// mismatch (map fixed at 260px while the card column next to it was
// taller). Below lg there's no shared row (map and cards each get their
// own line), so it falls back to a fixed height there instead.
export function ExpandableMap({
  proposals,
  totalCount,
}: {
  proposals: any[];
  totalCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      {/* White padded card around the map (same treatment as the modal's
          own bg-white p-3 shadow-xl wrapper below) instead of the map
          sitting directly on the cream page background — it was blending
          in with almost no visual separation. The padding also gives the
          map itself a bit of breathing room instead of its border sitting
          flush against the card edge. */}
      <div className="h-[260px] rounded-lg border border-neutral-200 bg-white p-2 shadow-sm lg:h-full">
        <div className="relative h-full">
          <PhillyMap proposals={proposals} totalCount={totalCount} fill />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute right-2 top-2 z-[500] rounded-md bg-white/90 px-2.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            <span aria-hidden="true">⤢</span> Expand map
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative w-full max-w-4xl rounded-lg bg-white p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close map"
              className="absolute right-3 top-3 z-[500] rounded-full bg-neutral-100 px-2.5 py-1 text-sm text-neutral-600 transition hover:bg-neutral-200"
            >
              ✕
            </button>
            <PhillyMap proposals={proposals} totalCount={totalCount} height={560} />
          </div>
        </div>
      )}
    </>
  );
}
