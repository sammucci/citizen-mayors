"use client";

import { useEffect, useState } from "react";
import { createProposal } from "@/app/proposals/actions";
import { NeighborhoodField } from "@/components/neighborhood-field";
import { readableTextColor } from "@/lib/readable-text-color";

type Category = { id: number; label: string; requires_budget: boolean; color: string };
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

export function NewProposalForm({
  categories,
  tags,
}: {
  categories: Category[];
  tags: Tag[];
}) {
  const [scope, setScope] = useState("citywide");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
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
    <form action={createProposal} className="mt-6 space-y-5">
      <Field label="Title">
        <input
          name="title"
          required
          placeholder={TITLE_SUGGESTIONS[placeholderIndex]}
          className="input"
        />
      </Field>

      <Field label="Type">
        <select name="type" className="input" defaultValue="policy">
          <option value="policy">Policy</option>
          <option value="project">Project</option>
        </select>
      </Field>

      <Field label="Category">
        <select
          name="category_id"
          required
          className="input"
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(Number(e.target.value))}
        >
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
              {c.requires_budget ? "" : " (no direct budget line)"}
            </option>
          ))}
        </select>
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
        <select
          name="geography_scope"
          className="input"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="citywide">Citywide</option>
          <option value="council_district">Council district</option>
          <option value="neighborhood">Neighborhood</option>
          <option value="zip">Zip code</option>
          <option value="address">Specific address / intersection</option>
        </select>
      </Field>

      {scope === "citywide" && (
        <p className="-mt-3 text-xs text-neutral-500">
          Citywide proposals show up when anyone filters by any council
          district, since they apply everywhere.
        </p>
      )}

      {scope === "council_district" && (
        <Field label="Which council district">
          <select name="council_district" required className="input">
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                District {d}
              </option>
            ))}
          </select>
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
        <Field label="Address or intersection">
          <input
            name="geography_label"
            required
            className="input"
            placeholder="e.g. Frankford & Girard"
          />
        </Field>
      )}

      <p className="-mt-3 text-xs text-neutral-500">
        Dropping a pin or drawing an area on a map is planned for a follow-up
        version.
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
          rows={10}
          className="input font-mono text-sm"
          placeholder="Write it the way you'd want it to read as real ordinance or project language..."
        />
        <p className="mt-1 text-xs text-neutral-500">
          Start a line with <code className="rounded bg-neutral-100 px-1">#</code>{" "}
          for a heading, or <code className="rounded bg-neutral-100 px-1">##</code>{" "}
          for a smaller one.
        </p>
      </Field>

      <Field label="Cover image (optional)">
        <input type="file" name="image" accept="image/*" className="text-sm" />
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
