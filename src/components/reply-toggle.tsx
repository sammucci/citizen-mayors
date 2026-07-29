"use client";

import { useState } from "react";
import { addComment } from "@/app/proposals/actions";
import { readableTextColor } from "@/lib/readable-text-color";

// Was a native <details>/<summary> — closed by default, but once a
// person actually clicked "Reply" and posted, the browser leaves that
// <details> in whatever open/closed state it was last toggled to.
// React doesn't manage that state (it's uncontrolled), so it just
// stays open through the page refresh after posting — and multiplied
// across a whole thread of replies-to-replies, everything ends up
// permanently expanded into a wall of open text boxes. This tracks
// open/closed itself and explicitly collapses back after a successful
// post, so a reply box only shows when someone's actively using it.
export function ReplyToggle({
  proposalId,
  versionId,
  parentCommentId,
  categoryColor,
}: {
  proposalId: string;
  versionId: string;
  parentCommentId: string;
  categoryColor: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex list-none cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
      >
        ↩ Reply
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await addComment(formData);
        setOpen(false);
      }}
      className="mt-2 w-full space-y-2"
    >
      <input type="hidden" name="proposal_id" value={proposalId} />
      <input type="hidden" name="version_id" value={versionId} />
      <input type="hidden" name="parent_comment_id" value={parentCommentId} />
      <textarea
        name="body"
        required
        rows={2}
        placeholder="Write a reply..."
        className="input text-sm"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          className="rounded px-2 py-1 text-xs"
          style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
        >
          Post reply
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
