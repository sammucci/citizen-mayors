"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addProposalGrant, removeProposalGrant } from "@/app/proposals/actions";
import { GrantField } from "@/components/grant-field";
import { readableTextColor } from "@/lib/readable-text-color";

type ProposalGrant = {
  id: string;
  note: string | null;
  submittedByName: string;
  grant: { id: string; name: string; funder: string | null; url: string | null; description: string | null };
};

// Folded into "Getting it done" (not its own top-level section) per
// Samantha's call — funding is part of what it takes to make a proposal
// real, same as the decision chain, just a different kind of entry.
// Only ever rendered when the proposal's funding_needed flag is on (see
// the parent page) — most proposals don't need this at all.
export function FundingLeadsSection({
  proposalId,
  grants,
  allGrants,
  isOwner,
  isAdmin,
  canContribute,
  categoryColor,
}: {
  proposalId: string;
  grants: ProposalGrant[];
  allGrants: { id: string; name: string; funder: string | null }[];
  isOwner: boolean;
  isAdmin: boolean;
  canContribute: boolean;
  categoryColor: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Funding leads
      </p>
      {grants.length === 0 && !adding && (
        <p className="mt-1 text-xs text-neutral-500">
          No funding leads logged yet — anyone can add one below.
        </p>
      )}
      {grants.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {grants.map((pg) => (
            <li
              key={pg.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-2.5 text-sm"
            >
              <div className="min-w-0">
                {pg.grant.url ? (
                  <a
                    href={pg.grant.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-duty-purple underline"
                  >
                    {pg.grant.name}
                  </a>
                ) : (
                  <span className="font-medium text-neutral-800">{pg.grant.name}</span>
                )}
                {pg.grant.funder && (
                  <p className="text-xs text-neutral-500">{pg.grant.funder}</p>
                )}
                {pg.grant.description && (
                  <p className="mt-0.5 text-xs text-neutral-600">{pg.grant.description}</p>
                )}
                {pg.note && (
                  <p className="mt-0.5 text-xs italic text-neutral-500">
                    Why this fits: {pg.note}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-neutral-400">Added by {pg.submittedByName}</p>
              </div>
              {(isOwner || isAdmin) && (
                <button
                  type="button"
                  onClick={async () => {
                    setRemovingId(pg.id);
                    const fd = new FormData();
                    fd.set("proposal_id", proposalId);
                    fd.set("proposal_grant_id", pg.id);
                    await removeProposalGrant(fd);
                    router.refresh();
                    setRemovingId(null);
                  }}
                  disabled={removingId === pg.id}
                  className="shrink-0 rounded-full border border-neutral-300 px-1.5 text-xs text-neutral-500 hover:border-duty-red hover:text-duty-red disabled:opacity-50"
                  title="Remove this lead"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!canContribute ? null : !adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          + Add a funding lead
        </button>
      ) : (
        <form
          action={async (formData) => {
            setError(null);
            const result = await addProposalGrant(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            router.refresh();
            setAdding(false);
          }}
          className="mt-2 space-y-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-2"
        >
          <input type="hidden" name="proposal_id" value={proposalId} />
          <GrantField grants={allGrants} />
          {error && <p className="text-xs text-duty-red">{error}</p>}
          <div className="flex gap-2">
            <button
              className="rounded px-2 py-1 text-xs"
              style={{ backgroundColor: categoryColor, color: readableTextColor(categoryColor) }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
