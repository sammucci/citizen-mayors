"use client";

import { useState } from "react";
import { updatePowerTreeNodeNote } from "@/app/proposals/actions";

// Same fix as CommentBody in v28, applied here: clicking "Edit role"
// used to open a second, separate text box below the note that was
// already showing — a confusing duplicate, since the old note stayed
// visible right above the edit box for it. Now editing swaps the note
// for an editable field in place; only one or the other ever shows.
export function DecisionChainNote({
  note,
  proposalId,
  nodeId,
  categoryColor,
}: {
  note: string | null;
  proposalId: string;
  nodeId: string;
  categoryColor: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <>
        {note && <p className="mt-1 text-xs text-neutral-500">{note}</p>}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 inline-flex list-none cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-white"
        >
          ✎ Edit role
        </button>
      </>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updatePowerTreeNodeNote(formData);
        setEditing(false);
      }}
      className="mt-1 flex items-center gap-1"
    >
      <input type="hidden" name="proposal_id" value={proposalId} />
      <input type="hidden" name="node_id" value={nodeId} />
      <input
        name="note"
        defaultValue={note ?? ""}
        placeholder="e.g. final sign-off"
        className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-0.5 text-xs"
      />
      <button
        className="shrink-0 rounded px-2 py-0.5 text-xs text-white"
        style={{ backgroundColor: categoryColor }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="shrink-0 rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50"
      >
        Cancel
      </button>
    </form>
  );
}
