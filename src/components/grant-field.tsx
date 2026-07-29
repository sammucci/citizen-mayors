"use client";

import { useEffect, useRef, useState } from "react";

type Grant = { id: string; name: string; funder: string | null };

// Same progressively-disclosed autocomplete-or-add pattern as
// DecisionMakerField: type a name, pick a match from the dropdown if one
// exists, or keep typing and a "brand new" set of fields (funder, link,
// description) appears since there's nothing to reuse yet. Once a name
// is resolved either way, a proposal-specific note field shows up last.
export function GrantField({ grants }: { grants: Grant[] }) {
  const [query, setQuery] = useState("");
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
      ? grants.slice(0, 8)
      : grants.filter((g) => g.name.toLowerCase().includes(trimmed)).slice(0, 8);

  const exactMatch = grants.find((g) => g.name.toLowerCase() === trimmed);
  const hasName = query.trim().length > 0;
  const isNewName = hasName && !exactMatch;

  return (
    <>
      <div ref={wrapRef} className="relative">
        <label className="block text-xs text-neutral-500">Grant or funding program</label>
        <div className="flex items-center gap-1.5">
          <input
            name="grant_name"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
            placeholder="Start typing a name..."
            className="w-full min-w-0 rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs text-neutral-500 hover:border-duty-red hover:text-duty-red"
              aria-label="Clear"
              title="Clear"
            >
              ✕
            </button>
          )}
        </div>
        {open && matches.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-neutral-200 bg-white shadow-md">
            {matches.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(g.name);
                    setOpen(false);
                  }}
                  className="block w-full px-2 py-1.5 text-left hover:bg-neutral-50"
                >
                  <span className="block truncate text-sm font-medium text-neutral-800">{g.name}</span>
                  {g.funder && (
                    <span className="block truncate text-xs text-neutral-500">{g.funder}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isNewName && (
        <div className="space-y-2 rounded border border-dashed border-neutral-300 bg-white p-2">
          <p className="text-[11px] text-neutral-500">New to the list — a few more details help other members recognize it later.</p>
          <label className="block">
            <span className="mb-0.5 block text-xs text-neutral-500">Funder (optional)</span>
            <input
              name="funder"
              placeholder="e.g. PA Dept of Community & Economic Development"
              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-xs text-neutral-500">Link (optional)</span>
            <input
              name="url"
              placeholder="https://..."
              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-xs text-neutral-500">
              What it typically funds / eligibility (optional)
            </span>
            <textarea
              name="description"
              rows={2}
              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
        </div>
      )}

      {hasName && (
        <label className="block">
          <span className="mb-0.5 block text-xs text-neutral-500">
            Why this fits this proposal (optional)
          </span>
          <input
            name="note"
            placeholder="e.g. likely qualifies under the parks improvement track"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
      )}
    </>
  );
}
