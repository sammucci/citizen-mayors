"use client";

import { useState } from "react";

// Since v31, a reply can itself be replied to with no depth limit — good
// for real back-and-forth, but a heavily-discussed comment can now grow
// a long vertical chain that pushes everything else on the page way
// down. Shows the first few replies and tucks the rest behind a "Show N
// more replies" toggle, at every nesting level (this wraps the reply
// list inside renderComment, so it applies uniformly whether it's a
// top-level comment's replies or a reply's own replies).
export function CollapsibleReplies({
  replies,
  threshold = 3,
}: {
  replies: React.ReactNode[];
  threshold?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = replies.length - threshold;
  const visible = expanded || hiddenCount <= 0 ? replies : replies.slice(0, threshold);

  return (
    <>
      {visible}
      {!expanded && hiddenCount > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs text-neutral-500 underline hover:text-neutral-700"
          >
            Show {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}
          </button>
        </li>
      )}
    </>
  );
}
