"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { suggestTag } from "@/app/proposals/actions";

type TagOption = { id: number; label: string };

// One box instead of two separate ones. Old flow: a collapsed "browse
// the whole tag list" details block, PLUS a completely separate text
// input with a datalist behind it — same underlying action either way,
// just split across two UIs for no real reason. This is just a
// type-ahead: start typing, matching tags show up below, click one and
// it's added. Nothing matches what you typed? A "add as a new tag" row
// shows up instead. One input, one dropdown, one action underneath —
// suggestTag already knows how to sort out attach-directly (owner,
// existing tag) vs. needs-approval (everyone else, or anything brand
// new), so the UI doesn't need to branch on that itself.
export function TagPicker({
  proposalId,
  availableTags,
  isOwner,
}: {
  proposalId: string;
  availableTags: TagOption[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const matches = useMemo(() => {
    const q = trimmed.toLowerCase();
    const list = q ? availableTags.filter((t) => t.label.toLowerCase().includes(q)) : availableTags;
    return list.slice(0, 20);
  }, [availableTags, trimmed]);
  const hasExactMatch = matches.some((t) => t.label.toLowerCase() === trimmed.toLowerCase());

  async function submitLabel(label: string) {
    if (!label.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    fd.set("label", label.trim());
    const result = await suggestTag(fd);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.refresh();
    setQuery("");
    setOpen(false);
    setSubmitting(false);
  }

  return (
    <div className="mt-3 border-t border-neutral-100 pt-3">
      <p className="text-xs text-neutral-500">Add a tag</p>
      <div className="relative mt-2 max-w-xs">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitLabel(hasExactMatch ? trimmed : matches[0]?.label ?? trimmed);
            }
          }}
          placeholder="Start typing to find or add a tag..."
          disabled={submitting}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs disabled:opacity-50"
        />
        {open && (matches.length > 0 || trimmed) && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border border-neutral-200 bg-white shadow-md">
            {matches.map((t) => (
              <button
                key={t.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submitLabel(t.label)}
                className="block w-full px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
              >
                {t.label}
              </button>
            ))}
            {trimmed && !hasExactMatch && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submitLabel(trimmed)}
                className="block w-full border-t border-dashed border-neutral-200 px-3 py-1.5 text-left text-xs italic text-neutral-500 hover:bg-neutral-50"
              >
                + Add &ldquo;{trimmed}&rdquo; as a new tag
              </button>
            )}
          </div>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-[11px] text-duty-red">{error}</p>
      ) : (
        <p className="mt-1 text-[11px] text-neutral-400">
          {isOwner
            ? "Pick an existing tag and it's attached right away. A brand-new one just needs an admin to finalize it."
            : "Pick an existing tag or add a new one — either way, the proposal owner gives the OK first."}
        </p>
      )}
    </div>
  );
}
