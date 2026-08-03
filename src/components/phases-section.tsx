"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addPhase, approvePhase, removePhase, reorderPhases, updatePhase, updatePhaseProgress } from "@/app/proposals/actions";
import { readableTextColor } from "@/lib/readable-text-color";

type Phase = {
  id: string;
  label: string;
  note: string | null;
  progress: "not_started" | "in_progress" | "done";
  status: "pending" | "approved";
  addedByName: string;
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
  const [selectedId, setSelectedId] = useState<string>(
    firstActivePhase?.id ?? (phases.length > 0 ? phases[phases.length - 1].id : "anchor")
  );
  const [insertMode, setInsertMode] = useState<"before" | "after" | null>(null);
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
  // Index within the real (non-anchor) phases array — needed for
  // move-left/right and insert-before/after, which only ever operate on
  // real phases and their neighbors.
  const realIndex = selectedPhase ? phases.findIndex((p) => p.id === selectedPhase.id) : -1;

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    setSelectedId(steps[clamped].id);
    setInsertMode(null);
    setEditing(false);
  }

  function persistOrder(newPhases: Phase[]) {
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    newPhases.forEach((p) => fd.append("phase_id", p.id));
    reorderPhases(fd).then(() => router.refresh());
  }

  function moveBy(delta: -1 | 1) {
    if (realIndex === -1) return;
    const target = realIndex + delta;
    if (target < 0 || target >= phases.length) return;
    const next = [...phases];
    [next[realIndex], next[target]] = [next[target], next[realIndex]];
    persistOrder(next);
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Phases</h2>
        <div className="flex items-center gap-1.5">
          {canContribute && (
            <button
              type="button"
              onClick={() => {
                goTo(steps.length - 1);
                setInsertMode("after");
              }}
              className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              + Add phase
            </button>
          )}
          <button
            type="button"
            onClick={() => goTo(selectedIndex - 1)}
            disabled={selectedIndex === 0}
            aria-label="Previous phase"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-sm text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goTo(selectedIndex + 1)}
            disabled={selectedIndex === steps.length - 1}
            aria-label="Next phase"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-sm text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Getting approval is one part of it. Here's the rest of what it actually takes to make this real, step by step.
      </p>

      {/* Numbered progress bar — click a number, or use ‹ › above, to
          jump to that phase. min-w per segment plus overflow-x-auto
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
              <div key={s.id} className="min-w-[64px] flex-1">
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
            );
          })}
        </div>
        <div className="mt-1 flex gap-1">
          {steps.map((s) => (
            <div key={s.id} className="min-w-[64px] flex-1 truncate text-center text-[10px] text-neutral-500">
              {s.label}
            </div>
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
            {selectedPhase.status === "pending" ? (
              <p className="mt-0.5 text-xs text-neutral-500">Suggested by {selectedPhase.addedByName}</p>
            ) : (
              <p className="mt-0.5 text-xs font-medium text-neutral-500">
                {PROGRESS_LABELS[selectedPhase.progress]}
              </p>
            )}
            {selectedPhase.note && (
              <p className="mt-2 text-sm text-neutral-700">{selectedPhase.note}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
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

            {isOwner && (
              <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-neutral-200 pt-2">
                {/* Icon buttons instead of a row of text links — same
                    icon-plus-hover-tooltip pattern already used for
                    approve (✓) and remove (✕) elsewhere in the app, so
                    this isn't a new convention, just the same one applied
                    here. The two "insert" buttons bake the direction
                    into the icon itself (+◀ / ▶+) rather than two plain
                    "+"s that would look identical sitting next to each
                    other. */}
                <button
                  type="button"
                  onClick={() => moveBy(-1)}
                  disabled={realIndex <= 0}
                  title="Move this phase earlier"
                  aria-label="Move this phase earlier"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-sm text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => setInsertMode(insertMode === "before" ? null : "before")}
                  title="Insert a new phase before this one"
                  aria-label="Insert a new phase before this one"
                  className={`flex h-7 w-9 items-center justify-center rounded-full border text-xs font-bold ${
                    insertMode === "before"
                      ? "border-neutral-500 bg-neutral-100 text-neutral-700"
                      : "border-dashed border-neutral-300 text-neutral-500 hover:bg-neutral-100"
                  }`}
                >
                  +◀
                </button>
                <div className="mx-1 h-5 w-px bg-neutral-200" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setInsertMode(insertMode === "after" ? null : "after")}
                  title="Insert a new phase after this one"
                  aria-label="Insert a new phase after this one"
                  className={`flex h-7 w-9 items-center justify-center rounded-full border text-xs font-bold ${
                    insertMode === "after"
                      ? "border-neutral-500 bg-neutral-100 text-neutral-700"
                      : "border-dashed border-neutral-300 text-neutral-500 hover:bg-neutral-100"
                  }`}
                >
                  ▶+
                </button>
                <button
                  type="button"
                  onClick={() => moveBy(1)}
                  disabled={realIndex === -1 || realIndex >= phases.length - 1}
                  title="Move this phase later"
                  aria-label="Move this phase later"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-sm text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ▶
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  title="Remove this phase"
                  className="ml-2 text-xs text-duty-red underline hover:opacity-80"
                >
                  Remove
                </button>
              </div>
            )}

            {confirmingRemove && (
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
          </>
        )}

        {/* Insert form — appends a brand-new phase either right before or
            right after whichever step is currently selected (or, from
            the anchor, right after it — i.e. as the very first real
            phase). */}
        {insertMode && (
          <form
            action={async (formData) => {
              await addPhase(formData);
              router.refresh();
              setInsertMode(null);
            }}
            className="mt-3 space-y-1.5 rounded-lg border border-dashed border-neutral-300 bg-white p-2.5"
          >
            <input type="hidden" name="proposal_id" value={proposalId} />
            <input
              type="hidden"
              name="insert_index"
              value={
                selectedPhase
                  ? insertMode === "before"
                    ? realIndex
                    : realIndex + 1
                  : 0
              }
            />
            <p className="text-[11px] text-neutral-500">
              {selectedPhase
                ? `Inserting ${insertMode} "${selectedPhase.label}"`
                : "Adding the first real phase, right after the anchor"}
            </p>
            <input
              name="label"
              required
              autoFocus
              placeholder="e.g. Write a letter to the editor"
              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <input
              name="note"
              placeholder="Optional note — why this step, or how to do it"
              className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
            />
            <div className="flex gap-1.5">
              <button
                className="rounded px-2 py-1 text-xs"
                style={{ backgroundColor: categoryColor, color: finalTextColor }}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setInsertMode(null)}
                className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {recommendedLabels.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-500">Common next steps for proposals like this one:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {recommendedLabels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("proposal_id", proposalId);
                  fd.set("label", label);
                  addPhase(fd).then(() => router.refresh());
                }}
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
