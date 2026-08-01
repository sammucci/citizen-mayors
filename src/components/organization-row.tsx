"use client";

import { useState } from "react";
import Link from "next/link";
import { renameOrganizationAdmin } from "@/app/admin/actions";
import { DeleteOrganizationButton } from "@/components/delete-organization-button";

// Inline rename, same pattern as DecisionMakerRow — organizations only
// have a name at the registry level (their profile fields: service area,
// topics, description, meeting info — live on organization_profiles,
// wiki-edited by anyone signed in on the org's own public page, not
// here). This screen is just for cleaning up the shared name list.
export function OrganizationRow({
  id,
  name,
  addedByName,
  addedById,
}: {
  id: string;
  name: string;
  addedByName: string | null;
  addedById: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      {editing ? (
        <form
          action={async (formData) => {
            setError(null);
            const result = await renameOrganizationAdmin(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setEditing(false);
          }}
          className="flex flex-1 flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <input
            name="name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            autoFocus
            className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <button className="shrink-0 rounded-full bg-duty-purple px-3 py-1 text-xs font-medium text-white">
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setNameValue(name);
              setError(null);
            }}
            className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
          {error && <p className="w-full text-xs text-duty-red">{error}</p>}
        </form>
      ) : (
        <>
          <button type="button" onClick={() => setEditing(true)} className="text-left" title="Rename">
            <span className="text-sm font-semibold hover:underline">{name}</span>
            <p className="mt-0.5 text-xs text-neutral-500">
              <Link href={`/organizations/${id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                View public profile ↗
              </Link>
              {addedByName && (
                <>
                  {" · added by "}
                  <Link href={`/u/${addedById}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {addedByName}
                  </Link>
                </>
              )}
            </p>
          </button>
          <DeleteOrganizationButton id={id} name={name} />
        </>
      )}
    </li>
  );
}
