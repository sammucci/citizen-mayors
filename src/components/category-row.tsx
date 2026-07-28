"use client";

import { useState } from "react";
import { updateCategory } from "@/app/admin/actions";

// Edit-in-place for one of the 7 founding categories — no add/delete here
// on purpose (see updateCategory), just fixing a label, description,
// color, budget flag, or sort position without touching the database by
// hand.
export function CategoryRow({
  id,
  label,
  description,
  color,
  requiresBudget,
  sortOrder,
}: {
  id: number;
  label: string;
  description: string | null;
  color: string;
  requiresBudget: boolean;
  sortOrder: number;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        {!editing && (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-800">{label}</p>
              {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
              <p className="mt-0.5 text-[11px] text-neutral-400">
                {requiresBudget ? "Requires a budget line" : "No direct budget line"} · sort {sortOrder}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Edit
            </button>
          </>
        )}
      </div>

      {editing && (
        <form
          action={async (formData) => {
            setError(null);
            const result = await updateCategory(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setEditing(false);
          }}
          className="mt-2 space-y-2"
        >
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-wrap gap-2">
            <label className="flex-1 basis-40">
              <span className="mb-1 block text-[11px] text-neutral-500">Label</span>
              <input
                name="label"
                defaultValue={label}
                autoFocus
                className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="w-28 shrink-0">
              <span className="mb-1 block text-[11px] text-neutral-500">Color</span>
              <input
                name="color"
                type="text"
                defaultValue={color}
                className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="w-20 shrink-0">
              <span className="mb-1 block text-[11px] text-neutral-500">Sort</span>
              <input
                name="sort_order"
                type="number"
                defaultValue={sortOrder}
                className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] text-neutral-500">Description</span>
            <textarea
              name="description"
              defaultValue={description ?? ""}
              rows={2}
              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            <input type="checkbox" name="requires_budget" defaultChecked={requiresBudget} />
            Requires a direct budget line
          </label>
          <div className="flex gap-2">
            <button className="rounded-full bg-duty-purple px-3 py-1 text-xs font-medium text-white">
              Save
            </button>
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
      )}
    </li>
  );
}
