"use client";

import { useState } from "react";
import { updateProposalDetails } from "@/app/proposals/actions";
import { NeighborhoodField } from "@/components/neighborhood-field";
import { readableTextColor } from "@/lib/readable-text-color";
import { SelectField } from "@/components/select-field";

type Category = { id: number; label: string };

const DISTRICTS = Array.from({ length: 10 }, (_, i) => i + 1);

// Owner-only "edit the basics" form — title, type, category, and geography.
// Body text has its own versioned flow ("Advance to a new version") and
// tags have their own add/remove UI, so neither lives here; this is just
// for the details that used to require deleting and reposting to change.
export function EditProposalForm({
  proposalId,
  categories,
  initial,
  categoryColor,
}: {
  proposalId: string;
  categories: Category[];
  initial: {
    title: string;
    type: string;
    category_id: number | null;
    geography_scope: string;
    geography_label: string | null;
    council_district: number | null;
  };
  categoryColor: string;
}) {
  const [scope, setScope] = useState(initial.geography_scope ?? "citywide");

  return (
    <form action={updateProposalDetails} className="mt-2 space-y-3 text-sm">
      <input type="hidden" name="proposal_id" value={proposalId} />

      <Field label="Title">
        <input name="title" required defaultValue={initial.title} className="input" />
      </Field>

      <Field label="Type">
        <SelectField name="type" defaultValue={initial.type}>
          <option value="policy">Policy</option>
          <option value="project">Project</option>
        </SelectField>
      </Field>

      <Field label="Category">
        <SelectField name="category_id" required defaultValue={initial.category_id ?? ""}>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
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

      {scope === "council_district" && (
        <Field label="Which council district">
          <SelectField
            name="council_district"
            required
            defaultValue={initial.council_district ?? ""}
          >
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
          <NeighborhoodField
            name="geography_label"
            defaultValue={initial.geography_label ?? ""}
            placeholder="e.g. Fishtown"
          />
        </Field>
      )}

      {scope === "zip" && (
        <Field label="Zip code">
          <input
            name="geography_label"
            required
            defaultValue={initial.geography_label ?? ""}
            className="input"
            placeholder="e.g. 19125"
          />
        </Field>
      )}

      {scope === "address" && (
        <>
          <Field label="Address or intersection">
            <input
              name="geography_label"
              required
              defaultValue={initial.geography_label ?? ""}
              className="input"
              placeholder="e.g. Frankford & Girard"
            />
          </Field>
          <p className="-mt-3 text-xs text-neutral-500">
            We'll place an exact pin on the map from this automatically — a
            street address or an intersection both work.
          </p>
        </>
      )}

      <button
        className="rounded-md px-3 py-1.5 text-xs font-medium"
        style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
      >
        Save changes
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
