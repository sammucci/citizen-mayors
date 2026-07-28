"use client";

import { useState } from "react";
import { deleteProposal } from "@/app/proposals/actions";

// Same "type delete to confirm" pattern used for removing a
// decision-maker from the chain — this permanently removes the whole
// proposal (comments, versions, decision chain, votes, all of it), so
// a stray click shouldn't be able to do it. Styled as a small pill to
// sit next to "Edit proposal details" rather than looking like a
// primary action.
export function DeleteProposalButton({ proposalId, title }: { proposalId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:border-duty-red hover:text-duty-red"
      >
        🗑 Delete proposal
      </button>
    );
  }

  return (
    <form
      action={deleteProposal}
      className="w-full space-y-1.5 rounded border border-duty-red/40 bg-duty-red/5 p-2"
    >
      <input type="hidden" name="proposal_id" value={proposalId} />
      <p className="text-xs text-neutral-700">
        Type <span className="font-semibold">delete</span> to permanently remove{" "}
        <span className="font-semibold">{title}</span> — its comments, decision chain, and votes
        all go with it. This can't be undone.
      </p>
      <div className="flex items-center gap-1.5">
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="delete"
          autoFocus
          className="w-28 rounded border border-neutral-300 px-2 py-1 text-xs"
        />
        <button
          disabled={confirmText.trim().toLowerCase() !== "delete"}
          className="rounded-full bg-duty-red px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Delete proposal
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmText("");
          }}
          className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
