"use client";

import { useEffect, useRef, useState } from "react";
import { PHILLY_NEIGHBORHOODS } from "@/lib/philly-neighborhoods";

// Autocomplete-as-you-type for the neighborhood field, matched against a
// fixed list of Philadelphia neighborhood names (see philly-neighborhoods.ts).
// This used to call out to Nominatim (OpenStreetMap's geocoder), but
// Nominatim matches whole words against its search index rather than
// doing true prefix matching — so "Fish" wouldn't surface "Fishtown"
// until most of the word was typed. A fixed list filters instantly and
// guarantees correct, consistent spelling/capitalization since there's
// nothing to mistype into it.
//
// Picking a suggestion locks in the clean name. Free-typed text that
// doesn't match anything in the list still works and still submits —
// this never blocks you from posting — it just won't offer a suggestion.
export function NeighborhoodField({
  name,
  defaultValue = "",
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const trimmed = query.trim().toLowerCase();
  const matches =
    trimmed.length === 0
      ? []
      : PHILLY_NEIGHBORHOODS.filter((n) => n.toLowerCase().includes(trimmed))
          // Names that start with what's been typed so far ("Fishtown"
          // for "fish") float above ones that just contain it somewhere
          // ("East Falls" for "falls" still shows, just lower).
          .sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(trimmed) ? 0 : 1;
            const bStarts = b.toLowerCase().startsWith(trimmed) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return a.localeCompare(b);
          })
          .slice(0, 8);

  return (
    <div ref={wrapRef} className="relative">
      <input
        name={name}
        required
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        placeholder={placeholder}
        className="input"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-neutral-200 bg-white shadow-md">
          {matches.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  setQuery(s);
                  setOpen(false);
                }}
                className="block w-full px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
