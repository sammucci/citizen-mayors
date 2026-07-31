"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateOrganizationStructuredFields,
  updateOrganizationDescription,
} from "@/app/organizations/actions";

type ProfileFields = {
  geography_scope: "citywide" | "council_district" | "zip";
  council_district: number | null;
  geography_label: string | null;
  topics: string[];
  meets_when: string | null;
  meets_where: string | null;
  description: string;
};

const DISTRICTS = Array.from({ length: 10 }, (_, i) => i + 1);

// Same wiki-editing model as decision-maker-profile-editor.tsx: any
// signed-in user can edit any field, accountable via organization_
// revisions rather than a narrower update policy. Boxes are bg-white
// from the start this time — the decision-maker version shipped without
// it and Samantha had to flag that the tan page background was showing
// through.
export function OrganizationProfileEditor({
  organizationId,
  canEdit,
  profile,
}: {
  organizationId: string;
  canEdit: boolean;
  profile: ProfileFields;
}) {
  const router = useRouter();
  const [editingFields, setEditingFields] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  // Local state just for the scope radios, so the conditional
  // district-select / zip-input can react as you click — same pattern
  // new-proposal-form.tsx uses for its own geography_scope picker.
  const [scope, setScope] = useState(profile.geography_scope);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Group details
          </p>
          {canEdit && !editingFields && (
            <button
              type="button"
              onClick={() => setEditingFields(true)}
              className="text-xs text-duty-purple underline"
            >
              Edit
            </button>
          )}
        </div>

        {!editingFields ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-400">Service area</dt>
              <dd>
                {profile.geography_scope === "citywide"
                  ? "Citywide"
                  : profile.geography_scope === "council_district" && profile.council_district
                  ? `District ${profile.council_district}`
                  : profile.geography_scope === "zip" && profile.geography_label
                  ? `Zip ${profile.geography_label}`
                  : "Not added yet"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Topics</dt>
              <dd>{profile.topics.length > 0 ? profile.topics.join(", ") : "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Meets when</dt>
              <dd>{profile.meets_when || "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Meets where</dt>
              <dd>{profile.meets_where || "Not added yet"}</dd>
            </div>
          </dl>
        ) : (
          <form
            action={async (formData) => {
              await updateOrganizationStructuredFields(formData);
              router.refresh();
              setEditingFields(false);
            }}
            className="mt-2 space-y-2"
          >
            <input type="hidden" name="organization_id" value={organizationId} />
            <div>
              <p className="text-xs text-neutral-600">Service area</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="geography_scope"
                    value="citywide"
                    checked={scope === "citywide"}
                    onChange={() => setScope("citywide")}
                  />
                  Citywide
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="geography_scope"
                    value="council_district"
                    checked={scope === "council_district"}
                    onChange={() => setScope("council_district")}
                  />
                  A council district
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="geography_scope"
                    value="zip"
                    checked={scope === "zip"}
                    onChange={() => setScope("zip")}
                  />
                  A zip code
                </label>
              </div>
              {scope === "council_district" && (
                <select name="council_district" defaultValue={profile.council_district ?? ""} className="input mt-1.5 w-auto text-xs">
                  <option value="">Choose a district</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      District {d}
                    </option>
                  ))}
                </select>
              )}
              {scope === "zip" && (
                <input
                  name="geography_label"
                  defaultValue={profile.geography_label ?? ""}
                  placeholder="e.g. 19125"
                  className="input mt-1.5 w-auto text-xs"
                />
              )}
            </div>
            <label className="block text-xs text-neutral-600">
              Topics (comma-separated)
              <input
                name="topics"
                defaultValue={profile.topics.join(", ")}
                placeholder="e.g. Housing, Public Safety, Zoning"
                className="input mt-0.5 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-neutral-600">
                Meets when
                <input
                  name="meets_when"
                  defaultValue={profile.meets_when ?? ""}
                  placeholder="e.g. First Tuesday, 7pm"
                  className="input mt-0.5 text-sm"
                />
              </label>
              <label className="block text-xs text-neutral-600">
                Meets where
                <input
                  name="meets_where"
                  defaultValue={profile.meets_where ?? ""}
                  placeholder="e.g. Free Library branch on 9th St"
                  className="input mt-0.5 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button className="rounded bg-duty-purple px-3 py-1 text-xs font-medium text-white">Save</button>
              <button
                type="button"
                onClick={() => setEditingFields(false)}
                className="rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">About this group</p>
            <p className="text-[11px] text-neutral-400">What do they actually do? Who's it for?</p>
          </div>
          {canEdit && !editingDescription && (
            <button
              type="button"
              onClick={() => setEditingDescription(true)}
              className="shrink-0 text-xs text-duty-purple underline"
            >
              Edit
            </button>
          )}
        </div>
        {!editingDescription ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
            {profile.description || "Nothing added yet — be the first to share what you know."}
          </p>
        ) : (
          <form
            action={async (formData) => {
              await updateOrganizationDescription(formData);
              router.refresh();
              setEditingDescription(false);
            }}
            className="mt-2 space-y-1.5"
          >
            <input type="hidden" name="organization_id" value={organizationId} />
            <textarea name="description" defaultValue={profile.description} rows={4} autoFocus className="input text-sm" />
            <div className="flex gap-2">
              <button className="rounded bg-duty-purple px-3 py-1 text-xs font-medium text-white">Save</button>
              <button
                type="button"
                onClick={() => setEditingDescription(false)}
                className="rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
