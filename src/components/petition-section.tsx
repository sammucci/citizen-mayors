"use client";

import { useState } from "react";
import { setPetitionUrl } from "@/app/proposals/actions";

// Sidebar box, appears once a proposal has real forward momentum (see
// proposals/[id]/page.tsx — gated on at least one phase marked "done",
// i.e. ready to move on to the next stage). Just the drafted petition
// (title + body composed from the proposal's own text) meant to be
// copy-pasted into an external platform — NOT a deep link (Change.org's
// start-a-petition flow has no working URL-based prefill, tested
// directly: query params like petition_title/petition_letter_body get
// silently ignored by their form), so a "one-click autofill" would just
// be a second silent failure wearing a nicer outfit. Copy-paste is the
// honest version of the same time-saving idea.
//
// Used to also have an on-platform "N Citizen Mayors ready to back a
// petition" counter with its own separate "I'll back this" button —
// removed per your call: it wasn't adding anything the proposal's own
// general support vote didn't already cover, and just read as a second,
// confusing kind of "support" button sitting right next to the real one.
// What happens now instead: anyone who's upvoted the PROPOSAL itself
// gets notified (bell) once a real petition link goes live for it — see
// the new item in lib/notifications.ts. The underlying
// proposal_petition_supporters table and addPetitionSupport/
// removePetitionSupport actions are left in place, just unused, in case
// you want the data or want to revisit this later.
export function PetitionSection({
  proposalId,
  phaseId,
  title,
  summary,
  petitionUrl,
  isOwner,
}: {
  proposalId: string;
  phaseId: string;
  title: string;
  summary: string;
  // The real, live petition link, once the owner's pasted one in — see
  // setPetitionUrl in proposals/actions.ts. Null until then.
  petitionUrl: string | null;
  isOwner: boolean;
}) {
  const [copied, setCopied] = useState<"title" | "body" | null>(null);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(petitionUrl ?? "");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlSaving, setUrlSaving] = useState(false);

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
    // No card chrome of its own on purpose — this always renders inside
    // a phase's own detail panel now (see phases-section.tsx), directly
    // under that phase's title and status. A second full white box
    // nested inside the gray phase card read as a separate, disconnected
    // thing rather than more detail about the phase you're already
    // looking at — a top border is enough to separate it from the
    // status buttons just above.
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <p className="text-xs text-neutral-500">
        A petition can help build pressure and show decision-makers how much support this has.
      </p>

      {/* The actual live link, once it exists, is the headline action —
          everything below (draft text, generic Change.org starter link)
          is what gets you TO a petition; this is what lets anyone
          actually sign the one that already exists. */}
      {petitionUrl && !editingUrl && (
        <a
          href={petitionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-between rounded-lg bg-duty-purple px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90"
        >
          ✍️ Sign the petition
          <span aria-hidden="true">→</span>
        </a>
      )}
      {isOwner && (
        <div className="mt-1.5">
          {editingUrl ? (
            <form
              action={async (formData) => {
                setUrlSaving(true);
                setUrlError(null);
                const result = await setPetitionUrl(formData);
                setUrlSaving(false);
                if (result?.error) setUrlError(result.error);
                else setEditingUrl(false);
              }}
              className="flex flex-wrap items-center gap-1.5"
            >
              <input type="hidden" name="proposal_id" value={proposalId} />
              <input type="hidden" name="phase_id" value={phaseId} />
              <input
                name="petition_url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://www.change.org/p/..."
                className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
              />
              <button
                disabled={urlSaving}
                className="rounded-full bg-duty-purple px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingUrl(false);
                  setUrlDraft(petitionUrl ?? "");
                  setUrlError(null);
                }}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              {urlError && <p className="w-full text-xs text-duty-red">{urlError}</p>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditingUrl(true)}
              className="text-xs text-duty-purple underline"
            >
              {petitionUrl ? "Change petition link" : "Already created it? Paste the link here"}
            </button>
          )}
        </div>
      )}

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
        above in once you're there.
      </p>
    </div>
  );
}
