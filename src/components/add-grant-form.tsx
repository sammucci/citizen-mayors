"use client";

import { useRef, useState } from "react";
import { addGrantAdmin } from "@/app/admin/actions";

// Same shape as add-decision-maker-form.tsx — lets an admin seed the
// shared grants registry directly instead of only ever reacting to
// whatever gets typed in while attaching a grant to a specific proposal.
export function AddGrantForm() {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
      <form
        ref={formRef}
        action={async (formData) => {
          const result = await addGrantAdmin(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          setError(null);
          formRef.current?.reset();
        }}
        className="grid gap-2 sm:grid-cols-2"
      >
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500">Name</span>
          <input
            name="name"
            required
            placeholder="e.g. PA DCED Redevelopment Assistance"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            onChange={() => setError(null)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500">Funder</span>
          <input
            name="funder"
            placeholder="e.g. PA Dept of Community & Economic Development"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500">Link (optional)</span>
          <input name="url" type="url" placeholder="https://..." className="w-full rounded border border-neutral-300 px-2 py-1 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-neutral-500">What it funds (optional)</span>
          <input
            name="description"
            placeholder="Plain-language eligibility / typical use"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <button className="rounded bg-duty-purple px-3 py-1.5 text-sm font-medium text-white">Add</button>
        </div>
      </form>
      {error && <p className="mt-1.5 text-xs text-duty-red">{error}</p>}
    </div>
  );
}
