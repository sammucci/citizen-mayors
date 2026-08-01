"use client";

import { useState } from "react";
import Link from "next/link";
import { updateGrantAdmin } from "@/app/admin/actions";
import { DeleteGrantButton } from "@/components/delete-grant-button";

// Inline edit (click to open the full field set, not just the name) —
// same "click to edit in place" pattern as DecisionMakerRow, but exposes
// all four fields at once since a grant's funder/link/description are
// just as likely to go stale as its name.
export function GrantRow({
  id,
  name,
  funder,
  url,
  description,
  addedByName,
  addedById,
}: {
  id: string;
  name: string;
  funder: string | null;
  url: string | null;
  description: string | null;
  addedByName: string | null;
  addedById: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3">
      {editing ? (
        <form
          action={async (formData) => {
            setError(null);
            const result = await updateGrantAdmin(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setEditing(false);
          }}
          className="space-y-1.5"
        >
          <input type="hidden" name="id" value={id} />
          <input name="name" defaultValue={name} required className="w-full rounded border border-neutral-300 px-2 py-1 text-sm" />
          <input
            name="funder"
            defaultValue={funder ?? ""}
            placeholder="Funder"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <input
            name="url"
            type="url"
            defaultValue={url ?? ""}
            placeholder="Link"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <input
            name="description"
            defaultValue={description ?? ""}
            placeholder="What it funds"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button className="rounded-full bg-duty-purple px-3 py-1 text-xs font-medium text-white">Save</button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-duty-red">{error}</p>}
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left" title="Edit">
            <span className="text-sm font-semibold hover:underline">{name}</span>
            <p className="mt-0.5 text-xs text-neutral-500">
              {funder ?? "No funder listed"}
              {url && (
                <>
                  {" · "}
                  <Link
                    href={url}
                    target="_blank"
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Link ↗
                  </Link>
                </>
              )}
              {addedByName && (
                <>
                  {" · added by "}
                  <Link
                    href={`/u/${addedById}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {addedByName}
                  </Link>
                </>
              )}
            </p>
            {description && <p className="mt-0.5 text-xs text-neutral-400">{description}</p>}
          </button>
          <DeleteGrantButton id={id} name={name} />
        </div>
      )}
    </li>
  );
}
