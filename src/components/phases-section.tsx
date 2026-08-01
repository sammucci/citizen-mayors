"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addPhase, approvePhase, removePhase, reorderPhases, updatePhaseProgress } from "@/app/proposals/actions";
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

// The "how does this actually get done" list — separate from the
// decision chain above it on the proposal page, and laid out horizontally
// left-to-right (per the GoVocal reference you sent) instead of stacked
// vertically, since a step-by-step process reads more naturally that way
// and the chain + phases both being tall vertical stacks side by side was
// too much of the same visual rhythm.
//
// A fixed "Map your decision chain" card always leads the list — same
// idea as the chain's own "We the people" anchor: not a real database
// row, can't be dragged, removed, or reordered, just always there as the
// first thing every project starts with before anything else gets added.
//
// Real phases (everything after the anchor) support the same
// crowdsourced trust model as the chain: anyone signed in can suggest
// one, the owner's own additions land approved immediately, anyone
// else's land pending until the owner approves or removes them. They can
// also be dragged into a new position or inserted into any gap between
// two existing phases — they used to only ever append at the end, which
// read as "just keep adding on top of each other" with no way to slot a
// step in between two you'd already added.
export function PhasesSection({
  proposalId,
  categoryColor,
  phases,
  isOwner,
  canContribute,
  recommendedLabels,
  councilPerson,
}: {
  proposalId: string;
  categoryColor: string;
  phases: Phase[];
  isOwner: boolean;
  canContribute: boolean;
  recommendedLabels: string[];
  councilPerson: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const finalTextColor = readableTextColor(categoryColor);

  // Local copy so a drag can move things around instantly, before the
  // server round-trip confirms it — same pattern as PowerTreeChain.
  const [ordered, setOrdered] = useState(phases);
  const [dragId, setDragId] = useState<string | null>(null);
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchOverGap, setTouchOverGap] = useState<number | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [openGap, setOpenGap] = useState<number | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  // Resync if the underlying data changed elsewhere (added/removed, or a
  // status/progress/note change) — same "content, not just id list"
  // fingerprint PowerTreeChain uses, so an approve or a progress update
  // never gets silently swallowed by a stale local copy.
  const currentKey = phases
    .map((p) => `${p.id}:${p.status}:${p.progress}:${p.note ?? ""}`)
    .join("|");
  const [syncedKey, setSyncedKey] = useState(currentKey);
  if (currentKey !== syncedKey) {
    setOrdered(phases);
    setSyncedKey(currentKey);
    setOpenGap(null);
  }

  function persistOrder(newOrdered: Phase[]) {
    setOrdered(newOrdered);
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    newOrdered.forEach((p) => fd.append("phase_id", p.id));
    reorderPhases(fd).then(() => router.refresh());
  }

  function handleDropAtIndex(targetIndex: number) {
    if (!dragId) return;
    const current = [...ordered];
    const fromIndex = current.findIndex((p) => p.id === dragId);
    if (fromIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    const adjustedTarget = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
    current.splice(adjustedTarget, 0, moved);
    persistOrder(current);
    setDragId(null);
  }

  function handlePointerDownOnHandle(e: React.PointerEvent, index: number, phaseId: string) {
    if (!isOwner) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragId(phaseId);
    setTouchDragIndex(index);
    setTouchOverGap(index);
  }

  function handlePointerMoveOnHandle(e: React.PointerEvent) {
    if (touchDragIndex === null) return;
    const x = e.clientX;
    let gap = 0;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (x > rect.left + rect.width / 2) gap = i + 1;
    });
    setTouchOverGap(gap);
  }

  function handlePointerUpOnHandle() {
    if (touchOverGap !== null) {
      handleDropAtIndex(touchOverGap);
    }
    setTouchDragIndex(null);
    setTouchOverGap(null);
  }

  // One-click add straight from a recommendation chip — skips the open
  // form entirely since the label's already decided; always appends at
  // the end (no insert_index). Still lands pending for a non-owner, same
  // as typing it in by hand would.
  function quickAdd(label: string) {
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    fd.set("label", label);
    addPhase(fd).then(() => router.refresh());
  }

  function GapInserter({ gapIndex, isDropTarget }: { gapIndex: number; isDropTarget?: boolean }) {
    if (!canContribute) return null;
    const isOpen = openGap === gapIndex;

    return (
      <div
        className={`flex shrink-0 items-stretch justify-center rounded transition-colors ${
          isDropTarget ? "bg-duty-purple/10 ring-2 ring-duty-purple/40" : ""
        }`}
      >
        {isOpen ? (
          <form
            action={async (formData) => {
              await addPhase(formData);
              router.refresh();
              setOpenGap(null);
            }}
            className="w-56 space-y-1.5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-2"
          >
            <input type="hidden" name="proposal_id" value={proposalId} />
            <input type="hidden" name="insert_index" value={gapIndex} />
            <input
              name="label"
              required
              autoFocus
              placeholder="e.g. Write a letter to the editor"
              className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
            />
            <input
              name="note"
              placeholder="Optional note"
              className="w-full rounded border border-neutral-300 px-2 py-1 text-[11px]"
            />
            <div className="flex gap-1.5">
              <button
                className="rounded px-2 py-1 text-[11px]"
                style={{ backgroundColor: categoryColor, color: finalTextColor }}
              >
                Insert here
              </button>
              <button
                type="button"
                onClick={() => setOpenGap(null)}
                className="rounded border border-neutral-300 px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpenGap(gapIndex)}
            className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full border border-dashed border-neutral-300 text-sm text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
            title="Insert a phase here"
          >
            +
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-base font-semibold">Phases</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Getting approval is one part of it. Here's the rest of what it actually takes to make this real, step by step.
      </p>

      {recommendedLabels.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-500">
            Common next steps for proposals like this one:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {recommendedLabels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => quickAdd(label)}
                className="rounded-full border border-dashed px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                style={{ borderColor: `${categoryColor}88` }}
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Horizontal, left-to-right scrollable timeline. overflow-x-auto
          with a bit of bottom padding keeps the scrollbar (on the
          platforms that show one) from sitting flush against the cards. */}
      <div className="mt-3 flex items-stretch gap-2 overflow-x-auto pb-2">
        {/* Fixed anchor — not a real phase, never draggable, never
            removable. Every project starts here, same idea as "We the
            people" on the decision chain. */}
        <div className="flex w-40 shrink-0 flex-col justify-center rounded-lg border border-dashed border-neutral-300 bg-cream/60 p-3 text-center">
          <span className="text-sm font-medium text-neutral-600">🗺️ Map your decision chain</span>
          <span className="mt-1 text-[11px] text-neutral-400">Always step one</span>
        </div>

        <GapInserter gapIndex={0} isDropTarget={touchDragIndex !== null && touchOverGap === 0} />

        {ordered.map((phase, i) => {
          const isPending = phase.status === "pending";
          return (
            <Fragment key={phase.id}>
              <div
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className={`flex w-56 shrink-0 flex-col rounded-lg border p-3 transition-opacity ${
                  isPending ? "border-dashed border-neutral-400" : "border-neutral-200"
                } ${touchDragIndex === i ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-1">
                    {isOwner && (
                      <span
                        onPointerDown={(e) => handlePointerDownOnHandle(e, i, phase.id)}
                        onPointerMove={handlePointerMoveOnHandle}
                        onPointerUp={handlePointerUpOnHandle}
                        onPointerCancel={handlePointerUpOnHandle}
                        style={{ touchAction: "none" }}
                        className="shrink-0 cursor-grab select-none text-sm"
                        title="Drag to reorder"
                        aria-hidden="true"
                      >
                        ⠿
                      </span>
                    )}
                    <span className="truncate text-sm font-semibold">{phase.label}</span>
                  </div>
                  {isOwner && (
                    <div className="flex shrink-0 items-center gap-1">
                      {isPending && (
                        <form
                          action={async (formData) => {
                            await approvePhase(formData);
                            router.refresh();
                          }}
                        >
                          <input type="hidden" name="proposal_id" value={proposalId} />
                          <input type="hidden" name="phase_id" value={phase.id} />
                          <button
                            className="rounded-full border border-neutral-300 px-1.5 text-xs text-neutral-500 hover:border-green-600 hover:text-green-600"
                            title="Approve this suggestion"
                          >
                            ✓
                          </button>
                        </form>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmingRemoveId(phase.id)}
                        className="rounded-full border border-neutral-300 px-1.5 text-xs text-neutral-500 hover:border-duty-red hover:text-duty-red"
                        title={isPending ? "Reject this suggestion" : "Remove this phase"}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {isPending && (
                  <p className="mt-0.5 text-[11px] text-neutral-500">Suggested by {phase.addedByName}</p>
                )}
                {phase.note && (
                  <p className="mt-1 text-xs italic text-neutral-500">{phase.note}</p>
                )}

                {!isPending && isOwner && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(["not_started", "in_progress", "done"] as const).map((p) => (
                      <form
                        key={p}
                        action={async (formData) => {
                          await updatePhaseProgress(formData);
                          router.refresh();
                        }}
                      >
                        <input type="hidden" name="proposal_id" value={proposalId} />
                        <input type="hidden" name="phase_id" value={phase.id} />
                        <input type="hidden" name="progress" value={p} />
                        <button
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                            phase.progress === p ? "" : "border-neutral-300 text-neutral-500 hover:bg-neutral-50"
                          }`}
                          style={
                            phase.progress === p
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
                {!isPending && !isOwner && (
                  <p className="mt-2 text-[11px] font-medium text-neutral-500">
                    {PROGRESS_LABELS[phase.progress]}
                  </p>
                )}

                {confirmingRemoveId === phase.id && (
                  <form
                    action={async (formData) => {
                      await removePhase(formData);
                      router.refresh();
                      setConfirmingRemoveId(null);
                    }}
                    className="mt-2 space-y-1 rounded border border-duty-red/40 bg-duty-red/5 p-1.5"
                  >
                    <input type="hidden" name="proposal_id" value={proposalId} />
                    <input type="hidden" name="phase_id" value={phase.id} />
                    <p className="text-[11px] text-neutral-700">
                      {isPending ? "Reject this suggested phase?" : "Remove this phase?"}
                    </p>
                    <div className="flex gap-1">
                      <button className="rounded bg-duty-red px-2 py-0.5 text-[11px] font-medium text-white">
                        {isPending ? "Reject" : "Remove"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingRemoveId(null)}
                        className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <GapInserter
                gapIndex={i + 1}
                isDropTarget={touchDragIndex !== null && touchOverGap === i + 1}
              />
            </Fragment>
          );
        })}

        {ordered.length === 0 && !canContribute && (
          <div className="flex w-56 shrink-0 items-center text-sm text-neutral-500">
            No phases mapped out yet.
          </div>
        )}
      </div>

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
