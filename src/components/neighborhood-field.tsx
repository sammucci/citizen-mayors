"use client";

import { useEffect, useRef, useState } from "react";

// Autocomplete-as-you-type for the neighborhood field, backed by
// OpenStreetMap's Nominatim geocoder (proxied through /api/geocode so we
// can set a proper User-Agent — see that route for why). Picking a
// suggestion locks in a correctly spelled, consistently capitalized
// neighborhood name instead of whatever a person happened to type.
// Free-typed text (typos, "Fishtown" vs "fishtown" vs "Fish Town") is
// effectively impossible to geocode later; this doesn't geocode the
// proposal itself yet (no lat/lng column exists — dropping a pin is
// still a follow-up), but it keeps the text clean enough that a future
// geocoding pass can actually work. Typing and pressing Enter without
// picking a suggestion still works — this never blocks submission.
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const thisRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        // Ignore stale responses from an earlier keystroke that resolved
        // after a more recent one.
        if (thisRequestId === requestIdRef.current) {
          setSuggestions(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch {
        if (thisRequestId === requestIdRef.current) {
          setSuggestions([]);
          setLoading(false);
        }
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

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
      {open && (suggestions.length > 0 || loading) && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-neutral-200 bg-white shadow-md">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  setQuery(s);
                  setSuggestions([]);
                  setOpen(false);
                }}
                className="block w-full px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
              >
                {s}
              </button>
            </li>
          ))}
          {loading && suggestions.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-neutral-400">Searching…</li>
          )}
        </ul>
      )}
    </div>
  );
}
