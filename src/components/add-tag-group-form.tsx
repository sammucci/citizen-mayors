"use client";

import { useRef, useState } from "react";
import { addTagGroup } from "@/app/admin/actions";

// Same shape as AddVolunteerCategoryGroupForm — adds a new curated
// topic (Pedestrian & Bike Safety, Housing, ...). Unlike tags, groups
// never grow on their own from what people type; this form is the only
// way a new one gets created.
export function AddTagGroupForm() {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <form
        ref={formRef}
        action={async (formData) => {
          const result = await addTagGroup(formData);
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
          <span className="mb-1 block text-xs text-neutral-500">Topic name</span>
          <input
            name="label"
            required
            placeholder="e.g. Pedestrian & Bike Safety"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            onChange={() => setError(null)}
          />
        </label>
        <button className="rounded bg-duty-purple px-3 py-1.5 text-sm font-medium text-white">
          Add topic
        </button>
      </form>
      {error && <p className="mt-1.5 text-xs text-duty-red">{error}</p>}
    </div>
  );
}
