"use client";

import { useState } from "react";

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
// redesign mockup. versions[0] must be the current (newest) version.
// categoryColor draws the same thin colored line across the top that the
// header card above it has, matching the original mockup.
export function VersionCarousel({
  versions,
  categoryColor,
}: {
  versions: Version[];
  categoryColor?: string | null;
}) {
  const [index, setIndex] = useState(0);
  const v = versions[index];
  if (!v) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="h-2" style={{ backgroundColor: categoryColor ?? "#e5e5e5" }} />
      <div className="p-4">
        <p className="whitespace-pre-wrap text-sm">{v.body}</p>

        {index !== 0 && v.change_note && (
          <p className="mt-3 text-xs italic text-neutral-500">
            What changed: {v.change_note}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-xs text-neutral-500">
            Version {v.version_number}
            {index === 0 && " (current)"}
          </span>
          {versions.length > 1 && (
            <div className="flex items-center gap-1.5">
              {versions.map((ver, i) => (
                <button
                  key={ver.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`View version ${ver.version_number}`}
                  title={`Version ${ver.version_number}`}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === index ? "bg-duty-purple" : "bg-neutral-300 hover:bg-neutral-400"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
