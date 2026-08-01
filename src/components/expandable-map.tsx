"use client";

import { useEffect, useState } from "react";
import { PhillyMap } from "./philly-map";

// The map used to always render at a fixed 500px, full width, above the
// entire proposal list — meant scrolling past it before seeing even the
// first project. This wraps the same PhillyMap in a shorter "preview"
// size that sits next to the first couple of proposal cards instead of
// above all of them (see the landing page layout), with a button that
// opens the exact same map full-size in a modal — so browsing pins in
// detail is still one click away, not gone. Desktop-focused per request;
// on narrow screens there's no side-by-side room to gain back anyway, so
// the preview just renders a bit shorter than before rather than
// changing layout.
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
      <div className="relative">
        <PhillyMap proposals={proposals} totalCount={totalCount} height={260} />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute right-2 top-2 z-[500] rounded-md bg-white/90 px-2.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
        >
          <span aria-hidden="true">⤢</span> Expand map
        </button>
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
