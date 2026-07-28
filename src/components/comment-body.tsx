"use client";

import { useState } from "react";
import { editComment } from "@/app/proposals/actions";
import { readableTextColor } from "@/lib/readable-text-color";

type Comment = {
  id: string;
  body: string;
  is_suggested_edit: boolean;
  suggested_body: string | null;
};

// Replaces the comment's own text in place when editing, instead of
// showing a second textarea below the already-displayed comment (which
// read as a confusing duplicate — you'd see the same text twice at
// once). Only ever shows the display OR the edit form, never both.
export function CommentBody({
  comment,
  proposalId,
  categoryColor,
}: {
  comment: Comment;
  proposalId: string;
  categoryColor: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <>
        <p className="mt-1 text-sm">{comment.body}</p>
        {comment.is_suggested_edit && (
          <p className="mt-2 whitespace-pre-wrap rounded bg-neutral-50 p-2 text-sm text-neutral-700">
            {comment.suggested_body}
          </p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 inline-flex list-none cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          ✎ Edit your comment
        </button>
      </>
    );
  }

  return (
    <form
      action={async (formData) => {
        await editComment(formData);
        setEditing(false);
      }}
      className="mt-2 space-y-2"
    >
      <input type="hidden" name="comment_id" value={comment.id} />
      <input type="hidden" name="proposal_id" value={proposalId} />
      <textarea name="body" defaultValue={comment.body} rows={2} className="input text-sm" />
      {comment.is_suggested_edit && (
        <textarea
          name="suggested_body"
          defaultValue={comment.suggested_body ?? ""}
          rows={3}
          className="input font-mono text-xs"
        />
      )}
      <div className="flex gap-2">
        <button
          className="rounded px-2 py-1 text-xs"
          style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
        >
          Save edit
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
