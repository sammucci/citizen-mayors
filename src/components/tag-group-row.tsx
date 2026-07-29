"use client";

import { useState } from "react";
import { deleteTagGroup, renameTagGroup } from "@/app/admin/actions";

// Same inline-rename / two-step-delete pattern as VolunteerCategoryGroupRow.
// Deleting a group never deletes or hides the tags inside it — they
// fall back to ungrouped (the DB column is `on delete set null`), so
// this is a safe, reversible action, not a destructive one.
export function TagGroupRow({
  id,
  label,
  tagCount,
}: {
  id: string;
  label: string;
  tagCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <form
            action={async (formData) => {
              setError(null);
              const result = await renameTagGroup(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              setEditing(false);
            }}
            className="flex flex-1 items-center gap-2"
          >
            <input type="hidden" name="id" value={id} />
            <input
              name="label"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <button className="shrink-0 rounded-full bg-duty-purple px-3 py-1 text-xs font-medium text-white">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue(label);
                setError(null);
              }}
              className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-neutral-800 hover:underline"
              title="Rename"
            >
              {label}{" "}
              <span className="font-normal text-neutral-400">
                ({tagCount} tag{tagCount === 1 ? "" : "s"})
              </span>
            </button>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-duty-red hover:text-duty-red"
              >
                Delete
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-neutral-500">
                  Delete "{label}"? Its tags become ungrouped, not deleted.
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    setError(null);
                    const fd = new FormData();
                    fd.set("id", id);
                    const result = await deleteTagGroup(fd);
                    if (result?.error) {
                      setError(result.error);
                      return;
                    }
                    setConfirmingDelete(false);
                  }}
                  className="shrink-0 rounded-full bg-duty-red px-3 py-1 text-xs font-medium text-white"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-duty-red">{error}</p>}
    </li>
  );
}
