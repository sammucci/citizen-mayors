"use client";

import { useState } from "react";

// CollapsibleReplies handles too many replies at ONE level (siblings).
// This handles the other shape of the same problem: a chain that goes
// deep rather than wide — reply to a reply to a reply — which a
// sibling-count threshold never catches since each level might only
// have one reply on it. Past the first level of replies, each further
// level starts collapsed behind its own "Show N more replies in this
// thread" toggle, so a long chain has to be drilled into on purpose
// one level at a time, instead of the whole page growing to fit it.
export function ThreadCollapser({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (open) return <>{children}</>;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-neutral-500 underline hover:text-neutral-700"
      >
        Show {count} more {count === 1 ? "reply" : "replies"} in this thread
      </button>
    </li>
  );
}
