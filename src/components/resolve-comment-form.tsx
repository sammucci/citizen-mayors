"use client";

import { useState } from "react";
import { resolveComment } from "@/app/proposals/actions";
import { statusColorClasses } from "@/lib/status-colors";

// Two things fixed here. First, the colored "Resolve"/"Change decision"
// pill button read as an unnecessary extra step — swapped for plain
// grey "Update" text, same treatment across all three options (Accept,
// Accept with contingency, Reject) rather than auto-submitting some and
// not others, which would've been a more surprising, less predictable
// interaction. Second, once a decision was made, the note box kept
// showing the just-typed contingency text even though that same text
// was now also displayed as a permanent "Contingency:" line on the
// comment — this collapses back to a compact status badge + a small
// "Change decision" toggle after saving, instead of leaving the form
// (and the now-duplicated text) sitting open.
export function ResolveCommentForm({
  commentId,
  proposalId,
  status,
  statusNote,
}: {
  commentId: string;
  proposalId: string;
  status: string;
  statusNote: string | null;
}) {
  const [editing, setEditing] = useState(status === "open");
  const [pendingStatus, setPendingStatus] = useState(
    status === "open" ? "accepted" : status
  );

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className={`rounded-full px-2 py-1 text-xs ${statusColorClasses(status)}`}>
          {status.replace(/_/g, " ")}
        </span>
        <button
          type="button"
          onClick={() => {
            setPendingStatus(status);
            setEditing(true);
          }}
          className="text-xs text-neutral-500 underline hover:text-neutral-700"
        >
          Change decision
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        await resolveComment(formData);
        setEditing(false);
      }}
      className="mt-2 space-y-2"
    >
      <input type="hidden" name="comment_id" value={commentId} />
      <input type="hidden" name="proposal_id" value={proposalId} />
      <div className="flex flex-wrap items-center gap-1.5">
        <label>
          <input
            type="radio"
            name="status"
            value="accepted"
            checked={pendingStatus === "accepted"}
            onChange={() => setPendingStatus("accepted")}
            className="peer sr-only"
          />
          <span className="cursor-pointer rounded-full border border-green-300 bg-green-50 px-2 py-1 text-xs text-green-700 peer-checked:bg-green-600 peer-checked:text-white">
            Accept
          </span>
        </label>
        <label>
          <input
            type="radio"
            name="status"
            value="accepted_with_contingency"
            checked={pendingStatus === "accepted_with_contingency"}
            onChange={() => setPendingStatus("accepted_with_contingency")}
            className="peer sr-only"
          />
          <span className="cursor-pointer rounded-full border border-yellow-300 bg-yellow-50 px-2 py-1 text-xs text-yellow-800 peer-checked:bg-yellow-400 peer-checked:text-yellow-900">
            Accept with contingency
          </span>
        </label>
        <label>
          <input
            type="radio"
            name="status"
            value="rejected"
            checked={pendingStatus === "rejected"}
            onChange={() => setPendingStatus("rejected")}
            className="peer sr-only"
          />
          <span className="cursor-pointer rounded-full border border-red-300 bg-red-50 px-2 py-1 text-xs text-duty-red peer-checked:bg-duty-red peer-checked:text-white">
            Reject
          </span>
        </label>
        <button type="submit" className="text-xs text-neutral-500 underline hover:text-neutral-700">
          Update
        </button>
      </div>

      {pendingStatus === "accepted_with_contingency" && (
        <input
          name="status_note"
          defaultValue={statusNote ?? ""}
          placeholder="What's the contingency?"
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
        />
      )}
    </form>
  );
}
