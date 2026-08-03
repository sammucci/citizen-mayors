"use client";

import { useState } from "react";
import { deletePopulationCategory, renamePopulationCategory } from "@/app/admin/actions";

// Same inline-rename-plus-confirm-delete pattern as VolunteerCategoryRow,
// minus the group dropdown — this registry doesn't have a grouping
// concept (it's already a small, flat, curated list; grouping a
// grouping-facet would be overkill). Renaming here also updates every
// past civic_logs row that used the old text (see renamePopulationCategory),
// so a correction shows up everywhere it's displayed, not just on future
// entries.
export function PopulationCategoryRow({
  id,
  label,
}: {
  id: string;
  label: string;
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
              const result = await renamePopulationCategory(formData);
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
              {label}
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
                <span className="text-xs text-neutral-500">Delete "{label}"?</span>
                <button
                  type="button"
                  onClick={async () => {
                    setError(null);
                    const fd = new FormData();
                    fd.set("id", id);
                    const result = await deletePopulationCategory(fd);
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
