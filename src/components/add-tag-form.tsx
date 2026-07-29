"use client";

import { useMemo, useRef, useState } from "react";
import { addTagAdmin } from "@/app/admin/actions";

type ExistingTag = { label: string; groupLabel: string | null };

// Same shape as AddVolunteerCategoryForm — lets an admin seed a project
// tag ahead of time instead of only ever getting new ones through
// someone suggesting it on a proposal.
//
// `existingTags` is the whole tags table, handed down so this can warn
// about a likely duplicate live, as you type — the actual problem
// Samantha ran into wasn't that duplicates could slip through (they
// can't: addTagAdmin already rejects an exact case-insensitive match,
// backed by a unique constraint on the tags table itself), it's that
// there was no easy way to tell what already existed across a dozen
// collapsed topics without opening every single one first. This makes
// that a non-issue — you see the answer before you even hit Add.
export function AddTagForm({ existingTags }: { existingTags: ExistingTag[] }) {
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const exactMatch = useMemo(() => {
    const typed = value.trim().toLowerCase();
    if (!typed) return null;
    return existingTags.find((t) => t.label.toLowerCase() === typed) ?? null;
  }, [value, existingTags]);

  // Near-matches (contains, not exact) — catches "Bike Lane" vs. "Bike
  // Lanes" style near-duplicates that aren't blocked outright but are
  // worth a second look before adding a near-twin.
  const similar = useMemo(() => {
    const typed = value.trim().toLowerCase();
    if (typed.length < 3 || exactMatch) return [];
    return existingTags
      .filter((t) => t.label.toLowerCase() !== typed && t.label.toLowerCase().includes(typed))
      .slice(0, 5);
  }, [value, existingTags, exactMatch]);

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <form
        ref={formRef}
        action={async (formData) => {
          const result = await addTagAdmin(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          setError(null);
          setValue("");
          formRef.current?.reset();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex-1 basis-48">
          <span className="mb-1 block text-xs text-neutral-500">Tag name</span>
          <input
            name="label"
            required
            placeholder="e.g. Housing"
            value={value}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
        </label>
        <button
          className="rounded bg-duty-purple px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={!!exactMatch}
        >
          Add
        </button>
      </form>
      {exactMatch && (
        <p className="mt-1.5 text-xs font-medium text-amber-700">
          Already exists{exactMatch.groupLabel ? ` under "${exactMatch.groupLabel}"` : " (ungrouped)"} —
          no need to add it again.
        </p>
      )}
      {!exactMatch && similar.length > 0 && (
        <p className="mt-1.5 text-xs text-neutral-500">
          Similar existing tags:{" "}
          {similar.map((t, i) => (
            <span key={t.label}>
              {i > 0 && ", "}
              <span className="font-medium text-neutral-700">{t.label}</span>
              {t.groupLabel ? ` (${t.groupLabel})` : ""}
            </span>
          ))}
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-duty-red">{error}</p>}
    </div>
  );
}
