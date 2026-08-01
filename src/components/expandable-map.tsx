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
// Fixed height (~2 stacked featured-card heights) rather than stretching
// to match the cards next to it — stretching used to pull the CARDS up
// to the map's height instead (grid row stretch cuts both ways), which
// left an ugly empty gap in a short card. The parent grid now opts out
// of stretch (items-start, see the landing page), so each side just
// takes its own height instead of matching the other. A real height
// (not just min-height) here, rather than relying on stretch to make it
// definite, is what lets PhillyMap's "fill" (h-full) sizing resolve
// cleanly instead of collapsing — a percentage height only resolves
// against a parent with a definite height.
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
          flush against the card edge. Border is brand purple now instead
          of neutral/white — a plain white border still blended into the
          cream background. */}
      <div className="h-[420px] rounded-lg border-2 border-duty-purple bg-white p-2 shadow-sm lg:h-[520px]">
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
