"use client";

import { useEffect, useRef, useState } from "react";

// Shows what the address will actually resolve to WHILE you're still
// typing, instead of only after posting — the geocoding fix (correct
// spelling/capitalization pulled from the geocoder's own matched
// address, not an echo of what was typed) was a real improvement, but it
// only showed up after the fact. This calls the exact same geocoder
// (via /api/geocode, which just wraps the same geocodeAddress() used at
// save time) so the preview can never say something different from what
// actually gets saved.
//
// Debounced (600ms after typing stops) and gated at 4+ characters so
// this doesn't fire a network request on every keystroke or on "F" — a
// real address/intersection needs at least that many characters to have
// any hope of matching something.
export function AddressField({
  name,
  defaultValue = "",
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 4) {
      setPreview(null);
      setNoMatch(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    setNoMatch(false);
    const thisRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        // A slower-typed-earlier request finishing after a faster later
        // one would otherwise flash a stale preview over the fresh one.
        if (thisRequestId !== requestIdRef.current) return;
        setPreview(data?.label ?? null);
        setNoMatch(!data?.label);
      } catch {
        if (thisRequestId !== requestIdRef.current) return;
        setPreview(null);
        setNoMatch(false); // a network hiccup isn't the same as "no match" — don't scare anyone off posting
      } finally {
        if (thisRequestId === requestIdRef.current) setChecking(false);
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div>
      <input
        name={name}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input"
        placeholder={placeholder}
        autoComplete="off"
      />
      {checking && (
        <p className="mt-1 text-xs text-neutral-400">Checking...</p>
      )}
      {!checking && preview && (
        // Clickable, not just informational — one click accepts the
        // corrected spelling/capitalization into the field itself,
        // instead of leaving you to notice a mismatch and retype it by
        // hand. Not live autofill-as-you-type on purpose: rewriting the
        // field out from under someone mid-keystroke would fight their
        // cursor and undo their own edits — this only ever replaces the
        // value on an explicit click. Already matches → clicking again
        // is a harmless no-op, so no need to hide it once accepted.
        <button
          type="button"
          onClick={() => setValue(preview)}
          className="mt-1 block text-left text-xs text-neutral-500 hover:text-neutral-700"
          title="Click to use this corrected version"
        >
          📍 Will show as: <span className="font-medium text-neutral-700 underline decoration-dotted">{preview}</span>
          {value.trim() !== preview && <span className="ml-1 text-neutral-400">(click to use this)</span>}
        </button>
      )}
      {!checking && noMatch && (
        <p className="mt-1 text-xs text-neutral-400">
          No match yet — double-check the spelling, or this may just not be in the map data. You can still post either way.
        </p>
      )}
    </div>
  );
}
