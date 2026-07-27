"use client";

import { useEffect, useRef, useState } from "react";

type DecisionMaker = { id: string; name: string; kind: string };

const KIND_LABELS: Record<string, string> = {
  elected_official: "Elected official",
  department: "City department",
  board_commission: "Board / commission",
  other: "Other",
};

// Replaces a native <input list="..."> datalist combo, which has real bugs
// across browsers: once a value is picked, clicking back in shows nothing,
// backspacing can get stuck, and on a fresh form (after a full-page reload
// following a server action) some browsers auto-refill the last submitted
// value instead of leaving it blank. This is a fully controlled component
// instead, so it always starts empty and always stays editable.
//
// It also auto-fills (and hides) the "kind" field whenever the typed name
// exactly matches someone already in the registry, since we already know
// what kind of decision-maker they are — the kind picker only needs to
// show up when you're genuinely adding someone new.
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
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-1.5 top-[26px] text-xs text-neutral-400 hover:text-neutral-600"
            aria-label="Clear"
          >
            ✕
          </button>
        )}
        {open && matches.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-neutral-200 bg-white text-sm shadow-md">
            {matches.map((dm) => (
              <li key={dm.id}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(dm.name);
                    setOpen(false);
                  }}
                  className="block w-full px-2 py-1 text-left hover:bg-neutral-50"
                >
                  {dm.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {exactMatch ? (
        <div>
          <label className="block text-xs text-neutral-500">Kind</label>
          <input type="hidden" name="kind" value={exactMatch.kind} />
          <p className="rounded bg-neutral-100 px-2 py-1 text-sm text-neutral-600">
            {KIND_LABELS[exactMatch.kind] ?? exactMatch.kind}
          </p>
        </div>
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
