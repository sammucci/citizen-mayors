"use client";

import { useRef, useState } from "react";
import { addOrganizationAdmin } from "@/app/admin/actions";

// Same shape as add-decision-maker-form.tsx / add-grant-form.tsx — lets
// an admin seed the shared organizations registry directly instead of
// only ever reacting to what a resident types while adding a group to
// their own civic profile.
export function AddOrganizationForm() {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <form
        ref={formRef}
        action={async (formData) => {
          const result = await addOrganizationAdmin(formData);
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
            placeholder="e.g. Fishtown Neighbors Association"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            onChange={() => setError(null)}
          />
        </label>
        <button className="rounded bg-duty-purple px-3 py-1.5 text-sm font-medium text-white">Add</button>
      </form>
      {error && <p className="mt-1.5 text-xs text-duty-red">{error}</p>}
    </div>
  );
}
