"use client";

import { useState } from "react";
import { createProposal } from "@/app/proposals/actions";

type Category = { id: number; label: string; requires_budget: boolean };
type Tag = { id: number; label: string };

const DISTRICTS = Array.from({ length: 10 }, (_, i) => i + 1);

export function NewProposalForm({
  categories,
  tags,
}: {
  categories: Category[];
  tags: Tag[];
}) {
  const [scope, setScope] = useState("citywide");

  return (
    <form action={createProposal} className="mt-6 space-y-5">
      <Field label="Title">
        <input name="title" required className="input" />
      </Field>

      <Field label="Type">
        <select name="type" className="input" defaultValue="policy">
          <option value="policy">Policy</option>
          <option value="project">Project</option>
        </select>
      </Field>

      <Field label="Category">
        <select name="category_id" required className="input">
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
          <input name="geography_label" required className="input" placeholder="e.g. Fishtown" />
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

      <Field label="Summary (one or two sentences)">
        <textarea name="summary" required rows={2} className="input" />
      </Field>

      <Field label="Full proposal text">
        <textarea
          name="body"
          required
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

      <button
        type="submit"
        className="rounded-md bg-duty-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Post proposal
      </button>
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
