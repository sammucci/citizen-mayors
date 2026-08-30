"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addPhase, approvePhase, removePhase, updatePhase, updatePhaseProgress } from "@/app/proposals/actions";
import { readableTextColor } from "@/lib/readable-text-color";
import { PetitionSection } from "@/components/petition-section";

type Phase = {
  id: string;
  label: string;
  note: string | null;
  progress: "not_started" | "in_progress" | "done";
  status: "pending" | "approved";
  addedByName: string;
  petitionUrl: string | null;
};

const PROGRESS_LABELS: Record<Phase["progress"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

// Redesigned per your GoVocal reference: a numbered progress bar across
// the top (click any number, or use the ‹ › arrows, to step through),
// and one phase's full detail shown below at a time — not a scrollable
// row of small cards, which read as "back end and messy" rather than a
// real part of the page.
//
// Step 1 is always a fixed "Map your decision chain" card — same idea as
// "We the people" on the decision chain itself: not a real database row,
// can't be moved, inserted around, or removed, just always there as
// where every project starts. Everything after it is a real phase.
//
// Selection tracks the phase's id (not a raw array index) so it follows
// the right phase around correctly even after a reorder or an insert
// shifts everyone else's position.
export function PhasesSection({
  proposalId,
  categoryColor,
  phases,
  isOwner,
  canContribute,
  recommendedLabels,
  councilPerson,
  anchorNodeCount,
  proposalTitle,
  proposalSummary,
}: {
  proposalId: string;
  categoryColor: string;
  phases: Phase[];
  isOwner: boolean;
  canContribute: boolean;
  recommendedLabels: string[];
  councilPerson: { id: string; name: string } | null;
  // How many decision-makers are already in the chain — the only real
  // signal step 1 has, since it isn't a database row with its own
  // progress field. Deliberately not a boolean "done": a chain can
  // always grow, so this only ever unlocks a dashed "started" treatment
  // (see the stepper below), never the solid "done" fill real phases get.
  anchorNodeCount: number;
  // Petition tools (draft-and-copy text) live INSIDE whichever phase is
  // actually about a petition — not as a separate sidebar box gated on
  // some unrelated phase being "done". A phase titled e.g. "Start a
  // petition" or "Circulate a petition" is where they show up, in that
  // phase's own detail panel, same as everything else about that phase.
  // See isPetitionPhase below. (The on-platform "back this petition"
  // counter that used to live here is gone — see PetitionSection.)
  proposalTitle: string;
  proposalSummary: string;
}) {
  const router = useRouter();
  const finalTextColor = readableTextColor(categoryColor);
  const anchorStarted = anchorNodeCount > 0;

  // Default to whatever phase is actually active — the first one that
  // isn't done yet — not just the last one added. If every phase is
  // already done, fall back to the last one (nothing left to point at).
  // Landing on a finished step by default doesn't tell you what to do
  // next; landing on the active one does. The anchor is deliberately
  // left out of this — it never reaches a "done" state to skip past, so
  // it never needs to steal the default spot from a real phase.
  const firstActivePhase = phases.find((p) => p.progress !== "done");
  // An active petition (approved + done) beats even that default — it's
  // the most likely reason someone landed here via the "This project has
  // an active petition" banner/link near the title, so land them
  // straight on it instead of whatever the generic "still active" rule
  // would have picked.
  const activePetitionPhase = phases.find(
    (p) => /petition/i.test(p.label) && p.status === "approved" && p.progress === "done"
  );
  const [selectedId, setSelectedId] = useState<string>(
    activePetitionPhase?.id ?? firstActivePhase?.id ?? (phases.length > 0 ? phases[phases.length - 1].id : "anchor")
  );
  const [isInserting, setIsInserting] = useState(false);
  // Which step the new phase lands after — its OWN piece of state, not
  // implied by whatever happens to be selected in the stepper above.
  // That was the actual bug you flagged: the add-phase form had no way
  // to change where it was inserting, because the position was silently
  // whatever step you'd last clicked. Now it's an explicit dropdown in
  // the form itself, and the "+" placeholder in the stepper moves live
  // as you change it.
  const [insertAfterId, setInsertAfterId] = useState<string>("anchor");
  // Controlled so the "common next steps" chips (below) can prefill it —
  // that's now the ONLY way any phase gets created (typed fresh, or
  // prefilled from a suggestion): one form, not three separate paths
  // that behaved slightly differently from each other.
  const [insertLabel, setInsertLabel] = useState("");
  const [insertNote, setInsertNote] = useState("");
  const [insertError, setInsertError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const steps: Array<{ id: string; label: string; phase: Phase | null }> = [
    { id: "anchor", label: "Map your decision chain", phase: null },
    ...phases.map((p) => ({ id: p.id, label: p.label, phase: p })),
  ];
  let selectedIndex = steps.findIndex((s) => s.id === selectedId);
  if (selectedIndex === -1) selectedIndex = steps.length - 1;
  const selected = steps[selectedIndex];
  const selectedPhase = selected.phase;
  // Matched on the phase's own label rather than a separate database
  // flag — same lightweight approach as the anchor step already uses.
  // Whatever you named the phase ("Start a petition," "Circulate a
  // petition for X") is what decides whether the petition tools show up
  // here, in that phase's own detail panel.
  const isPetitionPhase = Boolean(selectedPhase && /petition/i.test(selectedPhase.label));
  // Where the "+" placeholder shows up in the stepper, and what
  // insert_index actually gets sent — both derived from insertAfterId,
  // never from whatever's separately selected above.
  const insertAfterIndex = steps.findIndex((s) => s.id === insertAfterId);
  function phasesIndexAfter(afterId: string): number {
    const afterStep = steps.find((s) => s.id === afterId);
    if (!afterStep || !afterStep.phase) return 0; // anchor, or not found — insert as the first real phase
    const idx = phases.findIndex((p) => p.id === afterStep.phase!.id);
    return idx === -1 ? phases.length : idx + 1;
  }

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    setSelectedId(steps[clamped].id);
    setEditing(false);
  }

  // Single entry point for opening the add-phase form, whether from the
  // "+ Add a phase" button or a suggestion chip (which passes a
  // prefill). Deliberately does NOT touch selectedId/goTo anymore —
  // opening the form used to yank you over to whichever step it was
  // going to insert after (jarring, and part of "everything moving
  // around"); now the form has its own explicit "insert after" picker,
  // so it doesn't need to hijack what you're currently looking at.
  function openInsert(afterId: string, prefillLabel = "", prefillNote = "") {
    setIsInserting(true);
    setInsertAfterId(afterId);
    setInsertLabel(prefillLabel);
    setInsertNote(prefillNote);
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-base font-semibold">Phases</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Getting approval is one part of it. Here's the rest of what it actually takes to make this real, step by step.
      </p>

      {/* Its own bold callout up top, not just another dashed suggestion
          chip buried at the bottom — starting a petition is a real
          escalation for a proposal, not a routine next step, and it used
          to read as identically low-key as everything else down there.
          Hidden once a petition phase already exists (no suggesting a
          second one), AND gated on the decision chain actually having at
          least one decision-maker in it — a petition has to be addressed
          to someone, and on a brand-new proposal with an empty chain
          there's nobody yet to send it to. */}
      {canContribute && anchorNodeCount > 0 && !phases.some((p) => /petition/i.test(p.label)) && (
        <button
          type="button"
          onClick={() =>
            openInsert(
              steps[steps.length - 1].id,
              "Start a petition",
              "Draft a petition making the case, get residents to back it, and present it to decision-makers."
            )
          }
          className="mt-3 flex w-full items-center justify-between rounded-lg px-4 py-3 text-left shadow-sm transition hover:opacity-90"
          style={{ backgroundColor: categoryColor, color: finalTextColor }}
        >
          <span className="text-sm font-bold">📣 Ready to escalate? Start a petition</span>
          <span aria-hidden="true" className="text-lg">→</span>
        </button>
      )}

      {/* Numbered progress bar — click a number, or use ‹ Previous /
          Next › below, to jump to that phase. min-w per segment plus
          overflow-x-auto
          keeps this readable instead of squeezing every number down to
          nothing once there are more than a handful of phases.
          py-1 (not just pb-1) matters more than it looks like it should:
          setting overflow-x to auto makes the browser compute overflow-y
          as auto too (can't have scroll on only one axis), so this div
          clips anything that paints outside a step's own border box —
          which is exactly what the selected+done ring (ring-2, a
          box-shadow, not a real border) and the anchor's dashed border
          do. With no top padding, that top sliver of the ring/border was
          getting clipped flush against this container's own top edge. */}
      <div className="mt-4 overflow-x-auto py-1">
        <div className="flex gap-1">
          {steps.map((s, i) => {
            const isDone = s.phase?.progress === "done";
            // Step 1 has no progress field to be "done" — a decision
            // chain can always grow, so it only ever gets a dashed
            // outline once it has at least one entry, never the solid
            // green fill real phases get when actually finished. A real
            // phase marked "in progress" is the same underlying idea —
            // started, not finished — so it gets the identical dashed
            // treatment instead of a third distinct visual language.
            // Applied as a border on top of whatever fill the step
            // already has (selected/unselected), not instead of it.
            const isAnchorStarted = s.id === "anchor" && anchorStarted;
            const isInProgress = s.phase?.progress === "in_progress";
            const showsStartedBorder = isAnchorStarted || isInProgress;
            return (
              <Fragment key={s.id}>
              <div className="min-w-[64px] flex-1">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  // border-2 is ALWAYS present now, not just when
                  // showing the dashed "started" treatment — a real
                  // border adds to a box's rendered height (unlike the
                  // ring below, which is a box-shadow and doesn't),
                  // so a step that only sometimes got border-2 was
                  // sometimes 4px taller than its neighbors. Every step
                  // now reserves the same 2px border always; it's just
                  // transparent (invisible, but still taking up space)
                  // when there's nothing to show.
                  className={`w-full rounded-md border-2 py-2 text-xs font-bold transition ${
                    isDone && i === selectedIndex ? "ring-2 ring-offset-1" : ""
                  } ${showsStartedBorder ? "border-dashed border-green-600" : "border-transparent"}`}
                  style={
                    isDone
                      ? {
                          backgroundColor: "#16a34a", // green-600 — the whole bar, not just a small badge, so "done" reads at a glance
                          color: "#ffffff",
                          ...(i === selectedIndex ? ({ "--tw-ring-color": categoryColor } as React.CSSProperties) : {}),
                        }
                      : i === selectedIndex
                      ? { backgroundColor: categoryColor, color: finalTextColor }
                      : { backgroundColor: "#e5e5e5", color: "#737373" }
                  }
                  title={
                    isAnchorStarted
                      ? `${s.label} — started (${anchorNodeCount} so far)`
                      : isInProgress
                      ? `${s.label} — in progress`
                      : isDone
                      ? `${s.label} — done`
                      : s.label
                  }
                >
                  {/* Two absolute-positioning attempts (anchored to the
                      whole button's corner, then to a span around just
                      the digit) both drifted away from "2" at different
                      segment widths — a button centers its own text, so
                      neither corner was ever reliably NEAR the digit
                      itself. Plain inline flow next to the number sits
                      wherever the number sits, no matter how wide this
                      segment stretches, so it can't drift. Now that the
                      whole segment turns green when done, the badge
                      flips to a white circle with a green check instead
                      of the other way around, so it still stands out. */}
                  {i + 1}
                  {isDone && (
                    <span
                      aria-hidden="true"
                      className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white align-middle text-[8px] font-bold leading-none text-green-600"
                    >
                      ✓
                    </span>
                  )}
                </button>
              </div>
              {/* Visible placeholder right in the numbered bar, not just
                  a caption sentence below — this is the direct fix for
                  "you can't see where you're adding it": the new phase's
                  actual position, between two real steps, shown the same
                  way every other step is shown. Tied to insertAfterId
                  (the form's own explicit picker), NOT to whichever step
                  happens to be selected — moves live as you change the
                  dropdown, since that's the whole point of this marker. */}
              {isInserting && i === insertAfterIndex && (
                <div className="min-w-[64px] flex-1">
                  <div
                    className="flex w-full items-center justify-center rounded-md border-2 border-dashed py-2 text-xs font-bold"
                    style={{ borderColor: categoryColor, color: categoryColor }}
                  >
                    +
                  </div>
                </div>
              )}
              </Fragment>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1">
          {steps.map((s, i) => (
            <Fragment key={s.id}>
              <div className="min-w-[64px] flex-1 truncate text-center text-[10px] text-neutral-500">
                {s.label}
              </div>
              {isInserting && i === insertAfterIndex && (
                <div className="min-w-[64px] flex-1 truncate text-center text-[10px] font-semibold" style={{ color: categoryColor }}>
                  {insertLabel || "New phase"}
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Detail panel for whichever step is selected. */}
      <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        {!selectedPhase ? (
          <>
            <h3 className="text-base font-semibold text-neutral-800">🗺️ Map your decision chain — start here</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Every project needs this first: who actually has to say yes to make it real. It&apos;s not a
              description — it&apos;s a live section at the top of this page, waiting for names. Go add them.
              Your community is here to help fill it in.
            </p>
            {anchorStarted && (
              // Deliberately not "✓ Done" — a decision chain can always
              // grow as you learn who else needs to sign off, so this
              // stays a progress note ("started, N so far"), never a
              // claim that step 1 is finished. Real completion for the
              // chain lives at the individual decision-maker level (the
              // "I talked to them" checkbox on each node), not here.
              <p className="mt-2 text-xs font-medium text-green-700">
                ✓ Started — {anchorNodeCount} {anchorNodeCount === 1 ? "decision-maker" : "decision-makers"} mapped
                so far. This one stays open-ended rather than marked "done," since you can always add more as you
                learn who else needs to sign off.
              </p>
            )}
            <button
              type="button"
              onClick={() => document.getElementById("decision-chain-anchor")?.scrollIntoView({ behavior: "smooth" })}
              className="mt-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: categoryColor, color: finalTextColor }}
            >
              {anchorStarted ? "↑ Go add more" : "↑ Go do that first"}
            </button>
          </>
        ) : editing ? (
          // Inline edit form — fixes the gap where a phase, however it
          // was created (typed fresh, one-click-added from a "common
          // next steps" suggestion, or approved from someone else's
          // pending suggestion), had no way to correct a typo or add/
          // change its note afterward.
          <form
            action={async (formData) => {
              setEditError(null);
              const result = await updatePhase(formData);
              if (result?.error) {
                setEditError(result.error);
                return;
              }
              setEditing(false);
              router.refresh();
            }}
            className="space-y-1.5"
          >
            <input type="hidden" name="proposal_id" value={proposalId} />
            <input type="hidden" name="phase_id" value={selectedPhase.id} />
            <input
              name="label"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              autoFocus
              required
              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm font-semibold"
            />
            <input
              name="note"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Optional note — why this step, or how to do it"
              className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
            />
            <div className="flex gap-1.5">
              <button
                className="rounded px-2 py-1 text-xs font-medium"
                style={{ backgroundColor: categoryColor, color: finalTextColor }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditError(null);
                }}
                className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-white"
              >
                Cancel
              </button>
            </div>
            {editError && <p className="text-xs text-duty-red">{editError}</p>}
          </form>
        ) : (
          <>
            {/* Title on the left, status control on the right — this
                used to all stack in a single left-hand column (title,
                then a redundant status-text line, then the status
                buttons below that), which is exactly the "everything
                piled on the left" pattern to avoid. The pills
                themselves now show current status directly (the
                highlighted one), so the separate text line saying the
                same thing again is gone. */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedPhase.status === "pending" && (
                  <span className="inline-block rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    ⏳ Pending approval
                  </span>
                )}
                <h3 className="text-base font-semibold text-neutral-800">{selectedPhase.label}</h3>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditLabel(selectedPhase.label);
                      setEditNote(selectedPhase.note ?? "");
                      setEditError(null);
                      setEditing(true);
                    }}
                    title="Edit this phase"
                    aria-label="Edit this phase"
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    ✎
                  </button>
                )}
              </div>
              {selectedPhase.status === "pending" && isOwner && (
                <form
                  action={async (formData) => {
                    await approvePhase(formData);
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="proposal_id" value={proposalId} />
                  <input type="hidden" name="phase_id" value={selectedPhase.id} />
                  <button
                    className="rounded-full px-3 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: categoryColor }}
                  >
                    Approve this suggestion
                  </button>
                </form>
              )}
              {selectedPhase.status === "approved" && isOwner && (
                <div className="flex flex-wrap gap-1">
                  {(["not_started", "in_progress", "done"] as const).map((p) => (
                    <form
                      key={p}
                      action={async (formData) => {
                        await updatePhaseProgress(formData);
                        router.refresh();
                      }}
                    >
                      <input type="hidden" name="proposal_id" value={proposalId} />
                      <input type="hidden" name="phase_id" value={selectedPhase.id} />
                      <input type="hidden" name="progress" value={p} />
                      <button
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          selectedPhase.progress === p ? "" : "border-neutral-300 text-neutral-500 hover:bg-white"
                        }`}
                        style={
                          selectedPhase.progress === p
                            ? { backgroundColor: categoryColor, borderColor: categoryColor, color: finalTextColor }
                            : undefined
                        }
                      >
                        {PROGRESS_LABELS[p]}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </div>
            {selectedPhase.status === "pending" && (
              <p className="mt-0.5 text-xs text-neutral-500">Suggested by {selectedPhase.addedByName}</p>
            )}
            {selectedPhase.note && (
              <p className="mt-2 text-sm text-neutral-700">{selectedPhase.note}</p>
            )}

            {/* Remove — kept with THIS phase's own detail (unlike
                "+ Add a phase," which is a separate, standalone action
                now living below in the white area), right-aligned so it
                doesn't pile up under everything else on the left.
                The ◀ ▶ move-earlier/move-later buttons that used to sit
                here are gone — you flagged them as reading like broken
                "switch between phases" navigation (they didn't do that;
                they reordered the phase list), which was a fair
                misread since they sat right next to the phase title
                with no clearer explanation than a tooltip. Removed
                rather than relabeled. Real consequence: there is
                currently no way to reorder phases at all — say the
                word if you want that back in some other form (e.g. a
                drag handle on each stepper segment). */}
            {isOwner && (
              <div className="mt-3 flex items-center justify-end border-t border-neutral-200 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  title="Remove this phase"
                  className="text-xs text-duty-red underline hover:opacity-80"
                >
                  Remove
                </button>
              </div>
            )}

            {isPetitionPhase && selectedPhase.status === "approved" && (
              <PetitionSection
                proposalId={proposalId}
                phaseId={selectedPhase.id}
                title={proposalTitle}
                summary={proposalSummary}
                petitionUrl={selectedPhase.petitionUrl}
                isOwner={isOwner}
              />
            )}
          </>
        )}

        {confirmingRemove && selectedPhase && (
          <form
            action={async (formData) => {
              await removePhase(formData);
              router.refresh();
              setConfirmingRemove(false);
            }}
            className="mt-2 flex flex-wrap items-center gap-1.5 rounded border border-duty-red/40 bg-duty-red/5 p-2"
          >
            <input type="hidden" name="proposal_id" value={proposalId} />
            <input type="hidden" name="phase_id" value={selectedPhase.id} />
            <p className="flex-1 text-xs text-neutral-700">Remove this phase?</p>
            <button className="rounded bg-duty-red px-2 py-1 text-xs font-medium text-white">Remove</button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-white"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* "+ Add a phase" lives here now — outside the gray per-phase
          detail panel above, in the plain white card area. It used to be
          tucked into that panel's own bottom bar, which made it look like
          an action tied to whichever phase you had selected (it isn't —
          it's a standalone thing, and burying it up there was also why
          you had no way to change where the new phase actually landed:
          the position was silently "wherever you were last looking," not
          a real choice). Now it's its own button, and the form has an
          explicit "Insert after" picker so the "+" marker in the stepper
          above moves to wherever you actually pick, not just where you
          happened to be standing when you opened the form. Previous/Next
          step navigation is gone entirely — the numbered stepper above
          already does that job. */}
      {canContribute && (
        <div className="mt-3 border-t border-neutral-200 pt-3">
          {!isInserting ? (
            <button
              type="button"
              onClick={() => openInsert(selectedId)}
              className="block w-full rounded-lg py-2.5 text-center text-sm font-bold"
              style={{ backgroundColor: categoryColor, color: finalTextColor }}
            >
              + Add a phase
            </button>
          ) : (
            <form
              action={async (formData) => {
                setInsertError(null);
                try {
                  const result = await addPhase(formData);
                  router.refresh();
                  setIsInserting(false);
                  setInsertLabel("");
                  setInsertNote("");
                  setSelectedId(result.id); // land on the phase you just added, not the one you were already on
                } catch (e) {
                  setInsertError(e instanceof Error ? e.message : "Could not add that phase.");
                }
              }}
              className="space-y-1.5 rounded-lg border-2 p-3"
              style={{ borderColor: categoryColor, backgroundColor: `${categoryColor}0d` }}
            >
              <input type="hidden" name="proposal_id" value={proposalId} />
              <input type="hidden" name="insert_index" value={phasesIndexAfter(insertAfterId)} />
              <p className="text-sm font-semibold text-neutral-800">+ Add a phase</p>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Insert after</label>
                {/* This is the actual fix for "you still can't change
                    where it's adding" — a real, visible choice instead of
                    an implicit one tied to whatever was selected above. */}
                <select
                  value={insertAfterId}
                  onChange={(e) => setInsertAfterId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
                >
                  {steps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Phase name</label>
                <input
                  name="label"
                  required
                  autoFocus
                  value={insertLabel}
                  onChange={(e) => setInsertLabel(e.target.value)}
                  placeholder="e.g. Write a letter to the editor"
                  className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">
                  What does this step actually involve?
                </label>
                <input
                  name="note"
                  required
                  value={insertNote}
                  onChange={(e) => setInsertNote(e.target.value)}
                  placeholder="e.g. Draft a letter making the case, get 5 neighbors to co-sign, send to the district office"
                  className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                />
              </div>
              <div className="flex gap-1.5 pt-0.5">
                <button
                  className="rounded px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: categoryColor, color: finalTextColor }}
                >
                  Add phase
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsInserting(false);
                    setInsertError(null);
                  }}
                  className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-white"
                >
                  Cancel
                </button>
              </div>
              {insertError && <p className="text-xs text-duty-red">{insertError}</p>}
            </form>
          )}
        </div>
      )}

      {recommendedLabels.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-500">Common next steps for proposals like this one:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {recommendedLabels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() =>
                  // Prefills the same add-phase form below instead of
                  // skipping straight to the database — a suggestion is a
                  // starting point, not a finished phase, and it still
                  // needs a real note same as anything typed from
                  // scratch (what this looks like for YOUR proposal).
                  openInsert(steps[steps.length - 1].id, label)
                }
                className="rounded-full border border-dashed px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                style={{ borderColor: `${categoryColor}88` }}
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-500">
        {councilPerson ? (
          <>
            Stuck on what&apos;s next? Your council person is always a good place to start —{" "}
            <Link href={`/decision-makers/${councilPerson.id}`} className="underline hover:text-neutral-700">
              {councilPerson.name}
            </Link>{" "}
            can often point you toward the right next step.
          </>
        ) : (
          "Stuck on what's next? Your council person is always a good place to start for pointing you toward the right next step."
        )}
      </p>
    </div>
  );
}
