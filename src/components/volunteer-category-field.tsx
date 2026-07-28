"use client";

import { useEffect, useRef, useState } from "react";

// Same progressive-combobox pattern as DecisionMakerField, trimmed down —
// there's no second "kind" field to resolve here, just a name. Replaces
// the old plain free-text input, which let "Environment," "environment,"
// and "enviro" all count as different categories once volunteer hours
// started getting reported by category. Typing something that doesn't
// match anything in the list is still allowed (it becomes a new shared
// category the next person can pick, same as decision-makers) — this
// only helps people reuse what already exists, it doesn't lock them out
// of a fixed list.
export function VolunteerCategoryField({
  categories,
  defaultValue,
}: {
  categories: string[];
  defaultValue?: string | null;
}) {
  const [query, setQuery] = useState(defaultValue ?? "");
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
      ? categories.slice(0, 8)
      : categories.filter((c) => c.toLowerCase().includes(trimmed)).slice(0, 8);

  const isNew = query.trim().length > 0 && !categories.some((c) => c.toLowerCase() === trimmed);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-1.5">
        <input
          name="category"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          placeholder="Start typing a category..."
          className="input"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs text-neutral-500 hover:border-duty-red hover:text-duty-red"
            aria-label="Clear category"
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-neutral-200 bg-white shadow-md">
          {matches.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => {
                  setQuery(c);
                  setOpen(false);
                }}
                className="block w-full truncate px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
      {isNew && (
        <p className="mt-1 text-[11px] text-neutral-400">
          "{query.trim()}" isn't in the list yet — using it adds it as a new category.
        </p>
      )}
    </div>
  );
}
