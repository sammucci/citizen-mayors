"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { attachDecisionMakerTag, removeDecisionMakerTag } from "@/app/decision-makers/actions";

type TagOption = { id: number; label: string };
type AttachedTag = { id: number; label: string; addedById: string | null };

// Existing-tag-only version of tag-picker.tsx's search-as-you-type box —
// no "add as a new tag" branch here on purpose (see the migration
// comment: decision-makers have no owner concept, so there's no
// first-tier approver for the usual owner-then-admin new-tag flow). A
// brand-new topic tag gets created the normal way (on a proposal, or by
// an admin) and becomes attachable here afterward, same shared registry
// proposals already use.
export function DecisionMakerTagsSection({
  decisionMakerId,
  attachedTags,
  availableTags,
  canEdit,
  currentUserId,
  isAdmin,
}: {
  decisionMakerId: string;
  attachedTags: AttachedTag[];
  availableTags: TagOption[];
  canEdit: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
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

  async function attach(tagId: number) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const fd = new FormData();
    fd.set("decision_maker_id", decisionMakerId);
    fd.set("tag_id", String(tagId));
    const result = await attachDecisionMakerTag(fd);
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

  async function remove(tagId: number) {
    setError(null);
    const fd = new FormData();
    fd.set("decision_maker_id", decisionMakerId);
    fd.set("tag_id", String(tagId));
    const result = await removeDecisionMakerTag(fd);
    if (result?.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Issue tags</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        What is this decision-maker known to be active on? (In practice, not in theory.) Picked
        from the same tags used on proposals.
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {attachedTags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
          >
            #{t.label}
            {canEdit && (t.addedById === currentUserId || isAdmin) && (
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="text-neutral-400 hover:text-duty-red"
                aria-label={`Remove ${t.label}`}
                title="Remove"
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {attachedTags.length === 0 && <p className="text-xs text-neutral-400">No issue tags yet.</p>}
      </div>

      {canEdit && (
        <div className="relative mt-2 max-w-xs">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Add an issue tag..."
            disabled={submitting}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs disabled:opacity-50"
          />
          {open && matches.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border border-neutral-200 bg-white shadow-md">
              {matches.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => attach(t.id)}
                  className="block w-full px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {open && trimmed && matches.length === 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded border border-neutral-200 bg-white p-2 text-[11px] text-neutral-400 shadow-md">
              No matching tag — new tags can only be created from a proposal (or by an admin), then
              attached here.
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-duty-red">{error}</p>}
    </div>
  );
}
