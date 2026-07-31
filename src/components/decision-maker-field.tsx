"use client";

import { useEffect, useRef, useState } from "react";
import { SelectField } from "@/components/select-field";

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

// A progressively-disclosed replacement for the old native <input
// list="..."> datalist combo, which had real cross-browser bugs (stuck
// suggestions, backspace not working, values bleeding over between adds).
//
// Flow: only the name field shows at first. Once you type or pick a
// name, one of two things happens — if it exactly matches someone
// already in the registry, we already know their kind, so we skip
// straight to the role field. If it's a brand-new name, the kind picker
// appears; only once you've actually chosen a kind does the role field
// show up. Nothing appears before it's actually relevant.
export function DecisionMakerField({
  decisionMakers,
}: {
  decisionMakers: DecisionMaker[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(""); // only used for brand-new names
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
  const hasName = query.trim().length > 0;
  const isNewName = hasName && !exactMatch;
  const kindResolved = Boolean(exactMatch) || (isNewName && kind !== "");
  const showRole = hasName && kindResolved;

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
              setKind("");
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
              onClick={() => {
                setQuery("");
                setKind("");
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

      {exactMatch && <input type="hidden" name="kind" value={exactMatch.kind} />}

      {isNewName && (
        <div>
          <label className="block text-xs text-neutral-500">
            New person/office — what kind is this?
          </label>
          <SelectField
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="!rounded !py-1 !pl-2 !text-sm"
          >
            <option value="" disabled>
              Select a kind...
            </option>
            <option value="elected_official">Elected official</option>
            <option value="department">City department</option>
            <option value="board_commission">Board / commission</option>
            <option value="other">Other</option>
          </SelectField>
          {/* Elected officials specifically should be named by their seat
              ("Councilmember, District 3"), not the person currently
              holding it — the seat is the durable thing proposal chains
              and the profile page attach to; the person's actual name
              goes on that seat's profile page afterward. Typing a
              person's name here (e.g. from a chain that only knows "Jamie
              Gauthier") still works, it's just not ideal — someone can
              always rename it later from the profile page or admin. */}
          {kind === "elected_official" && (
            <p className="mt-1 text-[11px] text-neutral-500">
              Tip: name this by the office (e.g. &quot;Councilmember, District 3&quot;) rather than
              the person — you&apos;ll add their name on the profile page next.
            </p>
          )}
        </div>
      )}

      {showRole && (
        <div>
          <label className="block text-xs text-neutral-500">
            Role in decision-making process (optional)
          </label>
          <input
            name="note"
            placeholder="e.g. final sign-off"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
      )}
    </>
  );
}
