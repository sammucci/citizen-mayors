"use client";

import { useRef, useState } from "react";
import { addCaseStudy, removeCaseStudy } from "@/app/proposals/actions";

type CaseStudy = {
  id: string;
  projectName: string;
  location: string | null;
  cost: string | null;
  fundingSource: string | null;
  whoWasInvolved: string | null;
  challengesFeedback: string | null;
  sourceUrl: string | null;
};

// Sidebar box, sits directly under Tags per Samantha's ask — "here's a
// similar project, here's how it got funded, here's who was involved"
// as real-world precedent to lean on for a grant application. Each
// entry is a plain <details>/<summary> card (same expand-on-click
// pattern used elsewhere on this page, e.g. "Suggest specific
// replacement language") rather than a modal popup — one line
// collapsed (project name + location), the rest of the fields only
// appear once you click to expand it.
export function CaseStudiesSection({
  proposalId,
  caseStudies,
  canRemove,
  canAdd,
}: {
  proposalId: string;
  caseStudies: CaseStudy[];
  canRemove: boolean;
  canAdd: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-base font-semibold">Precedent &amp; case studies</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        Similar projects elsewhere — how they got funded, who was involved, what to watch out
        for. Useful groundwork for a grant application.
      </p>

      <div className="mt-3 space-y-2">
        {caseStudies.map((cs) => (
          <details key={cs.id} className="rounded-md border border-neutral-200 bg-neutral-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-neutral-800 marker:content-none">
              <span className="truncate">{cs.projectName}</span>
              {cs.location && (
                <span className="shrink-0 text-xs font-normal text-neutral-500">{cs.location}</span>
              )}
            </summary>
            <div className="space-y-1.5 border-t border-neutral-200 px-3 py-2.5 text-xs text-neutral-700">
              {cs.cost && (
                <p>
                  <span className="font-medium text-neutral-500">Cost: </span>
                  {cs.cost}
                </p>
              )}
              {cs.fundingSource && (
                <p>
                  <span className="font-medium text-neutral-500">Funding: </span>
                  {cs.fundingSource}
                </p>
              )}
              {cs.whoWasInvolved && (
                <p>
                  <span className="font-medium text-neutral-500">Who was involved: </span>
                  {cs.whoWasInvolved}
                </p>
              )}
              {cs.challengesFeedback && (
                <p>
                  <span className="font-medium text-neutral-500">Challenges / feedback: </span>
                  {cs.challengesFeedback}
                </p>
              )}
              {cs.sourceUrl && (
                <p>
                  <a
                    href={cs.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-duty-purple underline"
                  >
                    Source link
                  </a>
                </p>
              )}
              {!cs.cost && !cs.fundingSource && !cs.whoWasInvolved && !cs.challengesFeedback && !cs.sourceUrl && (
                <p className="text-neutral-400">No further detail added yet.</p>
              )}
              {canRemove && (
                <form action={removeCaseStudy} className="pt-1">
                  <input type="hidden" name="proposal_id" value={proposalId} />
                  <input type="hidden" name="case_study_id" value={cs.id} />
                  <button className="text-[11px] text-neutral-400 hover:text-duty-red">Remove</button>
                </form>
              )}
            </div>
          </details>
        ))}
        {caseStudies.length === 0 && (
          <p className="text-xs text-neutral-400">No case studies added yet.</p>
        )}
      </div>

      {canAdd && (
        <div className="mt-3">
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              + Add a case study
            </button>
          ) : (
            <form
              ref={formRef}
              action={async (formData) => {
                setError(null);
                const result = await addCaseStudy(formData);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                formRef.current?.reset();
                setOpen(false);
              }}
              className="space-y-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3"
            >
              <input type="hidden" name="proposal_id" value={proposalId} />
              <label className="block">
                <span className="mb-0.5 block text-xs text-neutral-500">Project name</span>
                <input
                  name="project_name"
                  required
                  placeholder="e.g. Vision Zero — New York City"
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-xs text-neutral-500">Location (optional)</span>
                <input
                  name="location"
                  placeholder="e.g. New York, NY"
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-xs text-neutral-500">Cost (optional)</span>
                <input
                  name="cost"
                  placeholder="e.g. ~$1.6M — exact figures welcome too"
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-xs text-neutral-500">Funding source (optional)</span>
                <input
                  name="funding_source"
                  placeholder="e.g. Federal Highway Safety Improvement Program"
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-xs text-neutral-500">Who was involved (optional)</span>
                <input
                  name="who_was_involved"
                  placeholder="e.g. City DOT, a local nonprofit, residents' association"
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-xs text-neutral-500">
                  Known challenges or helpful feedback (optional)
                </span>
                <textarea
                  name="challenges_feedback"
                  rows={2}
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-xs text-neutral-500">Source link (optional)</span>
                <input
                  name="source_url"
                  placeholder="https://..."
                  className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
              {error && <p className="text-xs text-duty-red">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                  className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button className="rounded bg-duty-purple px-3 py-1 text-xs font-medium text-white">
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
