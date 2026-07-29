"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFundingNeeded } from "@/app/proposals/actions";

// Owner-only flag, off by default — flips whether the "Funding leads"
// subsection shows up under Getting it done at all. Not every proposal
// needs funding (a policy change can cost nothing to pass); this keeps
// that subsection from cluttering the ones that don't. No confirm step
// either direction — turning it off never deletes any leads already
// attached, it just hides the subsection until it's turned back on.
export function FundingNeededToggle({
  proposalId,
  fundingNeeded,
}: {
  proposalId: string;
  fundingNeeded: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function submit(next: boolean) {
    setWorking(true);
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    fd.set("funding_needed", String(next));
    await toggleFundingNeeded(fd);
    router.refresh();
    setWorking(false);
  }

  return (
    <button
      type="button"
      disabled={working}
      onClick={() => submit(!fundingNeeded)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
        fundingNeeded
          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
          : "border-neutral-300 text-neutral-500 hover:bg-neutral-50"
      }`}
      title={fundingNeeded ? "This shows a Funding leads section — click to hide it" : "Flag this proposal as needing funding"}
    >
      💰 {fundingNeeded ? "Funding needed" : "Flag as needing funding"}
    </button>
  );
}
