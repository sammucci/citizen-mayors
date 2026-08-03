"use client";

import { useRef, useState } from "react";
import { addPopulationCategoryAdmin } from "@/app/admin/actions";

// Same shape as AddVolunteerCategoryForm, for the "who it was for"
// registry — but this one really is admin-only in practice (not just
// in the UI): this is the only place a population category ever gets
// created, since — unlike volunteer categories — nothing on the
// logging form can add a new one just by typing it.
export function AddPopulationCategoryForm() {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <form
        ref={formRef}
        action={async (formData) => {
          const result = await addPopulationCategoryAdmin(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          setError(null);
          formRef.current?.reset();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex-1 basis-48">
          <span className="mb-1 block text-xs text-neutral-500">Category name</span>
          <input
            name="label"
            required
            placeholder="e.g. Seniors"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            onChange={() => setError(null)}
          />
        </label>
        <button className="rounded bg-duty-purple px-3 py-1.5 text-sm font-medium text-white">
          Add
        </button>
      </form>
      {error && <p className="mt-1.5 text-xs text-duty-red">{error}</p>}
    </div>
  );
}
