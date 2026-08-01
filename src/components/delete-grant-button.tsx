"use client";

import { useState } from "react";
import { deleteGrantAdmin, forceDeleteGrantAdmin } from "@/app/admin/actions";

// Same confirm / in-use / force-delete pattern as
// delete-decision-maker-button.tsx — kept as a near-identical twin
// rather than a shared generic component, since the two registries hit
// different tables (proposal_grants vs. proposal_power_tree_nodes) with
// different messaging, and forcing them into one abstraction wasn't
// worth it for something this small.
export function DeleteGrantButton({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [inUseCount, setInUseCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [forceConfirmText, setForceConfirmText] = useState("");
  const [forcing, setForcing] = useState(false);

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
            const fd = new FormData();
            fd.set("grant_id", id);
            const result = await deleteGrantAdmin(fd);
            if (result?.error) {
              setError(result.error);
              setInUseCount(result.inUseCount ?? null);
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
            setInUseCount(null);
            setForceConfirmText("");
          }}
          className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="max-w-xs text-right text-xs text-duty-red">{error}</p>}
      {inUseCount != null && inUseCount > 0 && (
        <div className="mt-1 max-w-xs rounded-md border border-duty-red/30 bg-duty-red/5 p-2 text-right">
          <p className="text-[11px] text-neutral-600">
            Only use this for something that shouldn't be in the shared list at all — it
            detaches "{name}" from every proposal it's currently attached to. There's no undo.
          </p>
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            <input
              value={forceConfirmText}
              onChange={(e) => setForceConfirmText(e.target.value)}
              placeholder="delete"
              className="w-24 rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
            />
            <button
              type="button"
              disabled={forceConfirmText.trim().toLowerCase() !== "delete" || forcing}
              onClick={async () => {
                setForcing(true);
                const fd = new FormData();
                fd.set("grant_id", id);
                const result = await forceDeleteGrantAdmin(fd);
                setForcing(false);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                setConfirming(false);
                setInUseCount(null);
              }}
              className="shrink-0 rounded-full bg-duty-red px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
            >
              Force delete anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
