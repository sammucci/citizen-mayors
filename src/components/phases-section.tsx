"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addPhase, approvePhase, removePhase, updatePhaseProgress } from "@/app/proposals/actions";
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
// approval chain above it on the proposal page. Samantha's call: the
// chain is purely who has to say yes; everything else (write a letter to
// the editor, run a petition, secure funding, whatever this specific
// proposal actually needs) lives here instead, as an ordered, appendable
// list rather than a fixed template, since what's needed genuinely
// varies by proposal. Same crowdsourced trust model as the chain: anyone
// signed in can suggest a phase, the owner's own additions land approved
// immediately, anyone else's land pending until the owner approves or
// removes them.
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
  const [addingOpen, setAddingOpen] = useState(false);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  // One-click add straight from a recommendation chip — skips the open
  // form entirely since the label's already decided; still lands pending
  // for a non-owner, same as typing it in by hand would.
  function quickAdd(label: string) {
    const fd = new FormData();
    fd.set("proposal_id", proposalId);
    fd.set("label", label);
    addPhase(fd).then(() => router.refresh());
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

      <ul className="mt-3 space-y-1.5">
        {phases.map((phase) => {
          const isPending = phase.status === "pending";
          return (
            <li
              key={phase.id}
              className={`rounded-lg border p-3 ${isPending ? "border-dashed border-neutral-400" : "border-neutral-200"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isPending && (
                      <span className="inline-block rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        ⏳ Pending approval
                      </span>
                    )}
                    <span className="text-sm font-semibold">{phase.label}</span>
                  </div>
                  {isPending && (
                    <p className="mt-0.5 text-xs text-neutral-500">Suggested by {phase.addedByName}</p>
                  )}
                  {phase.note && (
                    <p className="mt-0.5 text-xs italic text-neutral-500">{phase.note}</p>
                  )}
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

              {!isPending && isOwner && (
                <div className="mt-2 flex flex-wrap gap-1.5">
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
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
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
                <p className="mt-1.5 text-[11px] font-medium text-neutral-500">
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
                  className="mt-2 flex flex-wrap items-center gap-1.5 rounded border border-duty-red/40 bg-duty-red/5 p-2"
                >
                  <input type="hidden" name="proposal_id" value={proposalId} />
                  <input type="hidden" name="phase_id" value={phase.id} />
                  <p className="flex-1 text-xs text-neutral-700">
                    {isPending ? "Reject this suggested phase?" : "Remove this phase?"}
                  </p>
                  <button className="shrink-0 rounded bg-duty-red px-2 py-1 text-xs font-medium text-white">
                    {isPending ? "Reject" : "Remove"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRemoveId(null)}
                    className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </li>
          );
        })}
        {phases.length === 0 && (
          <li className="text-sm text-neutral-500">No phases mapped out yet.</li>
        )}
      </ul>

      {canContribute && (
        <div className="mt-3">
          {addingOpen ? (
            <form
              action={async (formData) => {
                await addPhase(formData);
                router.refresh();
                setAddingOpen(false);
              }}
              className="space-y-1.5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-2"
            >
              <input type="hidden" name="proposal_id" value={proposalId} />
              <input
                name="label"
                required
                placeholder="e.g. Write a letter to the editor"
                className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                autoFocus
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
                  Add phase
                </button>
                <button
                  type="button"
                  onClick={() => setAddingOpen(false)}
                  className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingOpen(true)}
              className="rounded border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"
            >
              + Add a phase
            </button>
          )}
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
