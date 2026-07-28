"use client";

import { useState } from "react";
import { resolveComment } from "@/app/proposals/actions";

// The note box used to show unconditionally, no matter which of the
// three statuses was picked — reading like a leftover text box even
// when accepting or rejecting outright, neither of which needs an
// explanation. Now it only appears for "Accept with contingency", since
// that's the only status where there's actually something to note.
export function ResolveCommentForm({
  commentId,
  proposalId,
  defaultStatus,
  defaultNote,
  buttonLabel,
  categoryColor,
}: {
  commentId: string;
  proposalId: string;
  defaultStatus: string;
  defaultNote: string | null;
  buttonLabel: string;
  categoryColor: string;
}) {
  const [status, setStatus] = useState(defaultStatus);

  return (
    <form action={resolveComment} className="mt-2 space-y-2">
      <input type="hidden" name="comment_id" value={commentId} />
      <input type="hidden" name="proposal_id" value={proposalId} />
      <div className="flex flex-wrap gap-1.5">
        <label>
          <input
            type="radio"
            name="status"
            value="accepted"
            checked={status === "accepted"}
            onChange={() => setStatus("accepted")}
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
            checked={status === "accepted_with_contingency"}
            onChange={() => setStatus("accepted_with_contingency")}
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
            checked={status === "rejected"}
            onChange={() => setStatus("rejected")}
            className="peer sr-only"
          />
          <span className="cursor-pointer rounded-full border border-red-300 bg-red-50 px-2 py-1 text-xs text-duty-red peer-checked:bg-duty-red peer-checked:text-white">
            Reject
          </span>
        </label>
      </div>

      {status === "accepted_with_contingency" && (
        <input
          name="status_note"
          defaultValue={defaultNote ?? ""}
          placeholder="What's the contingency?"
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
        />
      )}

      <button
        className="shrink-0 rounded-full px-3 py-1 text-xs text-white"
        style={{ backgroundColor: categoryColor }}
      >
        {buttonLabel}
      </button>
    </form>
  );
}
