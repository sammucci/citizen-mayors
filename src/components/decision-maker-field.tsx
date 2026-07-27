"use client";

import { useEffect, useRef, useState } from "react";

type DecisionMaker = { id: string; name: string; kind: string };

// Council-roster entries are stored as "Name (Role, District X)" — split
// that into a bold primary name and a smaller subtitle, so long entries
// read cleanly on two lines instead of one cramped, overflowing line.
function splitLabel(name: string): { primary: string; subtitle: string | null } {
  const match = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { primary: match[1].trim(), subtitle: match[2].trim() };
  }
  return { primary: name, subtitle: null };
}

// Replaces a native <input list="..."> datalist combo, which has real bugs
// across browsers: once a value is picked, clicking back in shows nothing,
// backspacing can get stuck, and on a fresh form (after a full-page reload
// following a server action) some browsers auto-refill the last submitted
// value instead of leaving it blank. This is a fully controlled component
// instead, so it always starts empty and always stays editable.
//
// It also auto-fills the "kind" field (and hides the picker entirely)
// whenever the typed name exactly matches someone already in the
// registry, since we already know what kind of decision-maker they are —
// the kind picker only shows up when you're genuinely adding someone new.
export function DecisionMakerField({
  decisionMakers,
}: {
  decisionMakers: DecisionMaker[];
}) {
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
      ? decisionMakers.slice(0, 8)
      : decisionMakers
          .filter((dm) => dm.name.toLowerCase().includes(trimmed))
          .slice(0, 8);

  const exactMatch = decisionMakers.find(
    (dm) => dm.name.toLowerCase() === trimmed
  );

  return (
    <>
      <div ref={wrapRef} className="relative">
        <label className="block text-xs text-neutral-500">Decision-maker</label>
        <div className="flex items-center gap-1.5">
          <input
            name="decision_maker_name"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
            placeholder="Start typing, or add a new one"
            className="w-full min-w-0 rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setOpen(false);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs text-neutral-500 hover:border-duty-red hover:text-duty-red"
              aria-label="Clear decision-maker"
              title="Clear"
            >
              ✕
            </button>
          )}
        </div>
        {open && matches.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-neutral-200 bg-white shadow-md">
            {matches.map((dm) => {
              const { primary, subtitle } = splitLabel(dm.name);
              return (
                <li key={dm.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(dm.name);
                      setOpen(false);
                    }}
                    className="block w-full px-2 py-1.5 text-left hover:bg-neutral-50"
                  >
                    <span className="block truncate text-sm font-medium text-neutral-800">
                      {primary}
                    </span>
                    {subtitle && (
                      <span className="block truncate text-xs text-neutral-500">
                        {subtitle}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {exactMatch ? (
        <input type="hidden" name="kind" value={exactMatch.kind} />
      ) : (
        <div>
          <label className="block text-xs text-neutral-500">
            New person/office — what kind is this?
          </label>
          <select name="kind" className="w-full rounded border border-neutral-300 px-2 py-1 text-sm">
            <option value="elected_official">Elected official</option>
            <option value="department">City department</option>
            <option value="board_commission">Board / commission</option>
            <option value="other">Other</option>
          </select>
        </div>
      )}
    </>
  );
}
