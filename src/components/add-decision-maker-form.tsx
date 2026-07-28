"use client";

import { useRef, useState } from "react";
import { addDecisionMakerAdmin } from "@/app/admin/actions";

// Previously the only way into the shared registry was the "add new"
// option in the combobox while building a specific proposal's chain —
// this lets an admin add directly, e.g. seeding the roster ahead of
// time instead of only ever reacting to what a proposal happens to need.
export function AddDecisionMakerForm() {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <form
        ref={formRef}
        action={async (formData) => {
          const result = await addDecisionMakerAdmin(formData);
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
          <span className="mb-1 block text-xs text-neutral-500">Name</span>
          <input
            name="name"
            required
            placeholder="e.g. Streets Department"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            onChange={() => setError(null)}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-neutral-500">Kind</span>
          <select name="kind" defaultValue="other" className="rounded border border-neutral-300 px-2 py-1 text-sm">
            <option value="elected_official">Elected official</option>
            <option value="department">City department</option>
            <option value="board_commission">Board / commission</option>
            <option value="other">Other</option>
          </select>
        </label>
        <button className="rounded bg-duty-purple px-3 py-1.5 text-sm font-medium text-white">
          Add
        </button>
      </form>
      {error && <p className="mt-1.5 text-xs text-duty-red">{error}</p>}
    </div>
  );
}
