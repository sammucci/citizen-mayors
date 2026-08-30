"use client";

import { useEffect, useState } from "react";
import { createProposal } from "@/app/proposals/actions";
import { NeighborhoodField } from "@/components/neighborhood-field";
import { AddressField } from "@/components/address-field";
import { readableTextColor } from "@/lib/readable-text-color";
import { SelectField } from "@/components/select-field";

type Category = { id: number; label: string; description: string | null; requires_budget: boolean; color: string };
type Tag = { id: number; label: string };

const DISTRICTS = Array.from({ length: 10 }, (_, i) => i + 1);

// Rotates through a few real example titles as the placeholder, so an
// empty title box doesn't just sit there blank — gives people a concrete
// sense of scale/specificity ("Make N Front St intersections safer with
// stop signs" reads very differently than a vague "traffic safety").
// Purely a placeholder — never touches the actual value, so it doesn't
// interfere with typing.
const TITLE_SUGGESTIONS = [
  "Make N Front St intersections safer with stop signs",
  "Add exercise equipment for senior citizens in every neighborhood park",
  "Make the former Church of the Assumption a community center",
];

// A blank textarea in front of "write it like real ordinance language"
// is intimidating — this gives the body a light starting structure to
// write into instead of against, using the same ##-heading markdown
// already supported (and explained right below the box). It's a real
// `defaultValue`, not just a placeholder, so it's actually there to edit
// and replace rather than vanishing the moment someone starts typing —
// the bracketed prompts are what signal "swap this out," not literal
// content. Someone's still completely free to delete all of it and
// write freeform instead.
const BODY_STARTER = `## What it is
[Describe the core idea in a sentence or two.]

## Who it serves
[Who benefits — and who else might this affect?]

## Why it matters
[The problem this solves, or the opportunity it creates.]`;

// Matches cover-image-control.tsx's own limit/message exactly — that
// component (used to change a proposal's image after it's posted)
// already caught this same bug: a too-large file used to just fail
// silently, with the upload error swallowed and only logged
// server-side. This form had the identical problem on the FIRST image
// upload (at creation time), just harder to notice, since createProposal
// always redirects to the new proposal page whether or not the image
// actually made it — posting the proposal itself never failed, so
// there was no error to show, just a cover image that quietly never
// showed up.
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB

export function NewProposalForm({
  categories,
  tags,
}: {
  categories: Category[];
  tags: Tag[];
}) {
  const [scope, setScope] = useState("citywide");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);
  // Tracks the selected category so the submit button can pick up its
  // color live as you choose — same "buttons match the category"
  // treatment as the rest of the app, just live-updating here since
  // there's no saved proposal yet to read a color back from.
  const [categoryId, setCategoryId] = useState(categories?.[0]?.id ?? null);
  const selectedColor =
    categories?.find((c) => c.id === categoryId)?.color ?? "#6C3FD1";

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % TITLE_SUGGESTIONS.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <form
      action={(formData) => {
        const file = formData.get("image");
        if (file instanceof File && file.size > MAX_IMAGE_BYTES) {
          setImageError("Your cover image is too big — try a smaller file (under 20MB). The rest of the proposal won't be affected either way.");
          return;
        }
        setImageError(null);
        return createProposal(formData);
      }}
      className="mt-6 space-y-5"
    >
      <Field label="Title">
        <input
          name="title"
          required
          placeholder={TITLE_SUGGESTIONS[placeholderIndex]}
          className="input"
        />
      </Field>

      <Field label="Type">
        <SelectField name="type" defaultValue="policy">
          <option value="policy">Policy</option>
          <option value="project">Project</option>
        </SelectField>
      </Field>

      {/* Cards instead of a plain-text dropdown — Samantha's call:
          categories genuinely overlap in real proposals (a stop sign
          could read as Public Safety or as Infrastructure and
          Sanitation, depending on who's writing it), and a bare label in
          a <select> gives no way to judge which is the closer fit. The
          description on each card is the thing that actually helps you
          decide. Selection is tracked the same way it always was
          (categoryId state, already used for the submit button's live
          color) — just a hidden input carries it into the form now
          instead of a <select>'s own value. */}
      <Field label="Category">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories?.map((c) => {
            const selected = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                aria-pressed={selected}
                className="rounded-lg border p-3 text-left transition hover:bg-neutral-50"
                style={{
                  borderColor: selected ? c.color : "#e5e5e5",
                  backgroundColor: selected ? `${c.color}14` : "#ffffff",
                  boxShadow: selected ? `0 0 0 2px ${c.color}66` : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-sm font-semibold text-neutral-800">{c.label}</span>
                </div>
                {c.description && (
                  <p className="mt-1 text-xs leading-snug text-neutral-600">{c.description}</p>
                )}
                {!c.requires_budget && (
                  <p className="mt-1 text-[11px] italic text-neutral-400">No direct budget line</p>
                )}
              </button>
            );
          })}
        </div>
        {/* Not `required` on purpose — a hidden input can't be focused
            for native validation (some browsers throw "not focusable"
            and silently block submit instead of showing a message).
            categoryId already defaults to the first category on mount,
            so it's only ever empty if there are zero categories at all,
            in which case there's nothing to require anyway. */}
        <input type="hidden" name="category_id" value={categoryId ?? ""} />
      </Field>

      <Field label="Tags (select any that apply)">
        <div className="flex flex-wrap gap-3 text-sm">
          {tags?.map((t) => (
            <label key={t.id} className="flex items-center gap-1">
              <input type="checkbox" name="tag_ids" value={t.id} />
              {t.label}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Geographic scope">
        <SelectField
          name="geography_scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="citywide">Citywide</option>
          <option value="council_district">Council district</option>
          <option value="neighborhood">Neighborhood</option>
          <option value="zip">Zip code</option>
          <option value="address">Specific address / intersection</option>
        </SelectField>
      </Field>

      {scope === "citywide" && (
        <p className="-mt-3 text-xs text-neutral-500">
          Citywide proposals show up when anyone filters by any council
          district, since they apply everywhere.
        </p>
      )}

      {scope === "council_district" && (
        <Field label="Which council district">
          <SelectField name="council_district" required>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                District {d}
              </option>
            ))}
          </SelectField>
        </Field>
      )}

      {scope === "neighborhood" && (
        <Field label="Neighborhood name">
          <NeighborhoodField name="geography_label" placeholder="e.g. Fishtown" />
        </Field>
      )}

      {scope === "zip" && (
        <>
          <Field label="Zip code">
            <input name="geography_label" required className="input" placeholder="e.g. 19125" />
          </Field>
          <p className="-mt-3 text-xs text-neutral-500">
            We'll try to match this to a council district automatically. If
            your zip spans more than one district, you may need to add it by
            hand later — that lookup is still being built out.
          </p>
        </>
      )}

      {scope === "address" && (
        <>
          <Field label="Address or intersection">
            <AddressField
              name="geography_label"
              placeholder="e.g. Frankford & Girard"
            />
          </Field>
          <p className="-mt-3 text-xs text-neutral-500">
            We'll place an exact pin on the map from this automatically — a
            street address or an intersection both work.
          </p>
        </>
      )}

      <p className="-mt-3 text-xs text-neutral-500">
        Dropping a pin or drawing an area directly on a map is planned for a
        follow-up version.
      </p>

      {/* Not `required` — a draft only needs a title (see "Save as draft"
          below). createProposal() is what actually enforces summary/body
          being filled in, but only on the "Post proposal" path. */}
      <Field label="Summary (one or two sentences)">
        <textarea name="summary" rows={2} className="input" />
      </Field>

      <Field label="Full proposal text">
        <textarea
          name="body"
          rows={12}
          className="input font-mono text-sm"
          defaultValue={BODY_STARTER}
        />
        <p className="mt-1 text-xs text-neutral-500">
          A starting structure, not a requirement — write over it, rearrange it,
          or clear it and write freeform. Start a line with{" "}
          <code className="rounded bg-neutral-100 px-1">#</code> for a heading, or{" "}
          <code className="rounded bg-neutral-100 px-1">##</code> for a smaller one.
        </p>
      </Field>

      <Field label="Cover image (optional)">
        <input
          type="file"
          name="image"
          accept="image/*"
          className="text-sm"
          onChange={() => setImageError(null)}
        />
        {imageError && <p className="mt-1 text-xs text-duty-red">{imageError}</p>}
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="published"
          value="true"
          className="rounded-md px-4 py-2 text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: selectedColor, color: readableTextColor(selectedColor) }}
        >
          Post proposal
        </button>
        <button
          type="submit"
          name="published"
          value="false"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Save as draft
        </button>
        <span className="text-xs text-neutral-500">
          A draft only needs a title to save — fill in the rest whenever
          you're ready. It's only visible to you until you publish it.
        </span>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
