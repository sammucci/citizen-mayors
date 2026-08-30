"use client";

import { useState } from "react";
import Link from "next/link";
import { addPetitionSupport, removePetitionSupport } from "@/app/proposals/actions";

// Sidebar box, appears once a proposal has real forward momentum (see
// proposals/[id]/page.tsx — gated on at least one phase marked "done",
// i.e. ready to move on to the next stage). Two separate things live
// here, deliberately not merged into one "petition" concept:
//
// 1. A drafted petition (title + body composed from the proposal's own
//    text) meant to be copy-pasted into an external platform. This is
//    NOT a deep link — Change.org's start-a-petition flow has no
//    working URL-based prefill (tested directly: query params like
//    petition_title/petition_letter_body get silently ignored by their
//    form), so a "one-click autofill" would just be a second silent
//    failure wearing a nicer outfit. Copy-paste is the honest version
//    of the same time-saving idea.
// 2. An on-platform "N Citizen Mayors support this" counter — see
//    migration_proposal_petition_supporters.sql for why this is
//    deliberately NOT trying to be the signature-collection system
//    itself.
export function PetitionSection({
  proposalId,
  title,
  summary,
  supporterCount,
  iSupport,
  canParticipate,
}: {
  proposalId: string;
  title: string;
  summary: string;
  supporterCount: number;
  iSupport: boolean;
  canParticipate: boolean;
}) {
  const [copied, setCopied] = useState<"title" | "body" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const draftBody = `${summary || "[Add a sentence or two on why this matters.]"}\n\nWe're asking decision-makers to act on this: "${title}."\n\nThis proposal was developed on Citizen Mayors, a platform where Philadelphia residents build and track civic proposals through the city's real decision-making process.`;

  async function copy(text: string, which: "title" | "body") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      // Clipboard API can be blocked (permissions, non-HTTPS context in
      // some embeds) — not fatal, the text is still right there to
      // select by hand.
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-base font-semibold">Ready to take this further?</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        This proposal has real momentum — a petition can help build pressure and
        show decision-makers how much support it has.
      </p>

      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Petition title</span>
            <button
              type="button"
              onClick={() => copy(title, "title")}
              className="text-xs text-duty-purple underline"
            >
              {copied === "title" ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-800">
            {title}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Petition text</span>
            <button
              type="button"
              onClick={() => copy(draftBody, "body")}
              className="text-xs text-duty-purple underline"
            >
              {copied === "body" ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-1 whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-700">
            {draftBody}
          </p>
        </div>
      </div>

      <a
        href="https://www.change.org/start-a-petition"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
      >
        Continue to Change.org →
      </a>
      <p className="mt-1 text-[11px] text-neutral-400">
        Opens Change.org's own petition builder in a new tab — paste the text
        above in once you're there. (There's no way to hand it off pre-filled;
        we checked.)
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
        <p className="text-xs text-neutral-600">
          <span className="font-semibold text-neutral-800">{supporterCount}</span>{" "}
          Citizen Mayor{supporterCount === 1 ? "" : "s"} {supporterCount === 1 ? "is" : "are"} ready to back a
          petition on this.
        </p>
        {/* Deliberately NOT worded "I support this" — this page already
            has a general thumbs-up/down vote on the proposal itself
            ("+N net support"), which measures a different thing
            (broad sentiment on the idea, reversible either direction,
            available from day one). This is a narrower, one-way
            commitment that only exists once there's a petition to back
            — wording it differently is the whole fix for the exact
            confusion this label used to invite. */}
        {canParticipate ? (
          <form
            action={async (formData) => {
              setError(null);
              setPending(true);
              const result = iSupport
                ? await removePetitionSupport(formData)
                : await addPetitionSupport(formData);
              setPending(false);
              if (result?.error) setError(result.error);
            }}
          >
            <input type="hidden" name="proposal_id" value={proposalId} />
            <button
              disabled={pending}
              className={
                iSupport
                  ? "rounded-full border border-duty-purple/40 bg-duty-purple/10 px-3 py-1 text-xs font-medium text-duty-purple disabled:opacity-60"
                  : "rounded-full bg-duty-purple px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
              }
            >
              {iSupport ? "✓ You're backing this petition" : "I'll back this petition"}
            </button>
          </form>
        ) : (
          <Link href="/login" className="text-xs text-duty-purple underline">
            Sign in to back this petition
          </Link>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-duty-red">{error}</p>}
    </div>
  );
}
