"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteProposalFromList } from "@/app/proposals/actions";

export type ProposalMiniCardData = {
  id: string;
  title: string;
  type: string;
  imageUrl: string | null;
  imagePositionX: number | null;
  imagePositionY: number | null;
  categoryLabel: string | null;
  categoryColor: string | null;
  // Optional small caption under the category/type line — e.g. "(suggested,
  // not yet approved)" on a decision-maker's profile. Not used on the
  // profile page's "Your proposals," where every entry is a real one of
  // your own.
  note?: string;
};

// The two-column "mini card" — square image thumbnail on one side,
// title/category/type on the other, tinted with the category color —
// first built for the profile page's "Your proposals" list. Pulled out
// into its own shared component so the decision-maker profile's "Shows
// up in N proposals" can use the exact same treatment instead of a
// plainer link list, and so any future page that lists proposals (org
// profiles, next) gets it for free instead of a fresh copy-paste.
//
// showDelete is opt-in and OFF by default — this same component renders
// on decision-maker/org profiles too, where a delete button would make
// no sense (those aren't "your" proposals to remove). Only the profile
// page's own "Your proposals" grid passes it, and only for its owner or
// an admin (see deleteProposalFromList — Samantha's ask: admins pile up
// test proposals, and opening each one individually just to delete it
// was the actual complaint).
export function ProposalMiniCardGrid({
  proposals,
  emptyText,
  showDelete = false,
}: {
  proposals: ProposalMiniCardData[];
  emptyText: string;
  showDelete?: boolean;
}) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (proposals.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyText}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {proposals.map((p) => {
        const color = p.categoryColor ?? "#e5e5e5";
        const confirming = confirmingId === p.id;
        return (
          <li
            key={p.id}
            className="relative flex items-center overflow-hidden rounded-lg border"
            style={{ backgroundColor: `${color}1a`, borderColor: `${color}66` }}
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden" style={{ backgroundColor: color }}>
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{
                    objectPosition: `${p.imagePositionX ?? 50}% ${p.imagePositionY ?? 50}%`,
                  }}
                />
              )}
            </div>
            <div className="min-w-0 p-2">
              <Link href={`/proposals/${p.id}`} className="font-bryant block truncate text-sm font-semibold hover:underline">
                {p.title}
              </Link>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-neutral-500">
                {p.categoryLabel}
                {p.categoryLabel ? " · " : ""}
                {p.type}
              </p>
              {p.note && <p className="mt-0.5 truncate text-[10px] text-neutral-400">{p.note}</p>}
            </div>

            {showDelete && !confirming && (
              <button
                type="button"
                onClick={() => setConfirmingId(p.id)}
                title="Delete proposal"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-xs text-neutral-500 hover:bg-white hover:text-duty-red"
              >
                ✕
              </button>
            )}
            {showDelete && confirming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/95 p-2 text-center">
                <p className="text-[11px] font-medium text-neutral-700">Delete this proposal?</p>
                <div className="flex items-center gap-2">
                  <form
                    action={async (formData) => {
                      await deleteProposalFromList(formData);
                      router.refresh();
                    }}
                  >
                    <input type="hidden" name="proposal_id" value={p.id} />
                    <button className="rounded bg-duty-red px-2 py-0.5 text-[11px] font-medium text-white">
                      Delete
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
