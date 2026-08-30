"use client";

import { useState } from "react";
import { renderMarkdownLite } from "@/lib/markdown-lite";

type Version = {
  id: string;
  version_number: number;
  body: string;
  change_note: string | null;
  created_at: string;
};

// Replaces the old "current version box" + separate expandable "Version
// history" accordion with a single paged view — dots below the text let
// you flip back through past versions, matching the proposal-page
// redesign mockup. `versions` comes in newest-first (versions[0] is
// current).
//
// This renders just the inner content (no outer card/border) — the page
// wraps it together with the header into a single continuous card, with
// a colored divider between them, rather than this having its own
// separate box.
export function VersionCarousel({
  versions,
  categoryColor,
}: {
  versions: Version[];
  categoryColor: string;
}) {
  // Flipped to chronological order (oldest -> newest) so the dots read
  // left-to-right the way people expect from a pager — with the incoming
  // newest-first order, the current version's dot was showing up first
  // (leftmost), which read backwards.
  const chronological = versions.slice().reverse();
  const currentIndex = chronological.length - 1;
  const [index, setIndex] = useState(currentIndex);
  const v = chronological[index];
  if (!v) return null;

  return (
    <>
      {renderMarkdownLite(v.body)}

      {/* Real bug: this used to be gated on `index !== currentIndex` —
          i.e. it only ever showed a version's own change note while
          looking at an OLDER version, never the current one. That's
          backwards from what actually happens: you type "what changed
          and why" when you advance to a new version, that new version
          immediately becomes the current one, and the note should show
          right there — not vanish until some later version pushes this
          one into the past. Version 1 is excluded on purpose (its note
          is always the auto-generated "Initial version.", not something
          you actually typed). */}
      {v.change_note && v.version_number > 1 && (
        <p className="mt-3 text-xs italic text-neutral-500">
          What changed: {v.change_note}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
        <span className="text-xs text-neutral-500">
          Version {v.version_number}
          {index === currentIndex && " (current)"}
        </span>
        {chronological.length > 1 && (
          <div className="flex items-center gap-1.5">
            {chronological.map((ver, i) => (
              <button
                key={ver.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`View version ${ver.version_number}`}
                title={`Version ${ver.version_number}`}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === index ? "" : "bg-neutral-300 hover:bg-neutral-400"
                }`}
                style={i === index ? { backgroundColor: categoryColor } : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
