"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleProposalPublished } from "@/app/proposals/actions";

// Reversible alternative to a hard delete — unpublishing takes the
// proposal out of public view (comments, decision chain, and votes all
// stay intact underneath) and it can be republished just as easily.
// Unpublishing has a one-step confirm since it does hide something
// that may already have real engagement on it; republishing doesn't
// need one — bringing something back is low-risk.
export function PublishToggleButton({
  proposalId,
  published,
}: {
  proposalId: string;
  published: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  async function submit(nextPublished: boolean) {
    setWorking(true);
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    fd.set("published", String(nextPublished));
    await toggleProposalPublished(fd);
    router.refresh();
    setWorking(false);
    setConfirming(false);
  }

  if (published) {
    if (!confirming) {
      return (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:border-duty-red hover:text-duty-red"
        >
          Unpublish
        </button>
      );
    }
    return (
      <div className="flex w-full items-center gap-1.5 rounded border border-duty-red/40 bg-duty-red/5 p-2 text-xs">
        <span className="text-neutral-700">
          Take this down from public view? Comments, decision chain, and votes stay intact — you
          can republish anytime.
        </span>
        <button
          type="button"
          disabled={working}
          onClick={() => submit(false)}
          className="shrink-0 rounded-full bg-duty-red px-3 py-1 font-medium text-white disabled:opacity-50"
        >
          Unpublish
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={working}
      onClick={() => submit(true)}
      className="inline-flex items-center gap-1.5 rounded-full bg-duty-purple px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
    >
      {working ? "Publishing…" : "Publish"}
    </button>
  );
}
