"use client";

import { useState } from "react";
import { deleteDecisionMaker } from "@/app/admin/actions";

// Deletion can fail (the entry's in use somewhere), and that needs to
// show up as a real message next to the row, not just a console error —
// same reasoning as the image-too-big fix on cover images.
export function DeleteDecisionMakerButton({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-duty-red hover:text-duty-red"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Delete "{name}"?</span>
        <button
          type="button"
          onClick={async () => {
            setError(null);
            const result = await deleteDecisionMaker(
              (() => {
                const fd = new FormData();
                fd.set("decision_maker_id", id);
                return fd;
              })()
            );
            if (result?.error) {
              setError(result.error);
              return;
            }
            setConfirming(false);
          }}
          className="shrink-0 rounded-full bg-duty-red px-3 py-1 text-xs font-medium text-white"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="max-w-xs text-right text-xs text-duty-red">{error}</p>}
    </div>
  );
}
