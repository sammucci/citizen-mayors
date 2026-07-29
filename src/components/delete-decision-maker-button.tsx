"use client";

import { useState } from "react";
import { deleteDecisionMaker, forceDeleteDecisionMaker } from "@/app/admin/actions";

// Deletion can fail (the entry's in use somewhere), and that needs to
// show up as a real message next to the row, not just a console error —
// same reasoning as the image-too-big fix on cover images. When it's in
// use, a second, more deliberate confirmation ("force delete anyway,
// removes it from every chain it's in") is offered — this is the escape
// hatch for an abusive or inappropriate entry someone snuck into the
// shared registry, since without it, the normal safety check would leave
// it stuck there forever with no way to actually remove it.
export function DeleteDecisionMakerButton({ id, name }: { id: string; name: string }) {
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
            const result = await deleteDecisionMaker(
              (() => {
                const fd = new FormData();
                fd.set("decision_maker_id", id);
                return fd;
              })()
            );
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
            Only use this for something that shouldn't be in the shared list at all
            (abusive or inappropriate) — it removes "{name}" from every proposal's chain
            it's currently part of. There's no undo.
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
                fd.set("decision_maker_id", id);
                const result = await forceDeleteDecisionMaker(fd);
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
