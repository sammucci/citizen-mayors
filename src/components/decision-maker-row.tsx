"use client";

import { useState } from "react";
import Link from "next/link";
import { renameDecisionMaker } from "@/app/admin/actions";
import { DeleteDecisionMakerButton } from "@/components/delete-decision-maker-button";
import { splitDecisionMakerLabel } from "@/lib/decision-maker-label";
import { SelectField } from "@/components/select-field";

const KIND_OPTIONS = [
  { value: "elected_official", label: "Elected official" },
  { value: "department", label: "City department" },
  { value: "board_commission", label: "Board / commission" },
  { value: "other", label: "Other" },
];

// Inline rename (click the name to edit it, same as VolunteerCategoryRow)
// plus the existing delete-with-confirm button — previously this
// registry only supported add + delete, so a typo or wrong "kind" could
// only be fixed by deleting and re-adding, which fails outright if the
// entry's already in use in some proposal's decision chain.
export function DecisionMakerRow({
  id,
  name,
  kind,
  addedByName,
  addedById,
}: {
  id: string;
  name: string;
  kind: string;
  addedByName: string | null;
  addedById: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [kindValue, setKindValue] = useState(kind);
  const [error, setError] = useState<string | null>(null);

  const { primary, subtitle } = splitDecisionMakerLabel(name);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      {editing ? (
        <form
          action={async (formData) => {
            setError(null);
            const result = await renameDecisionMaker(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setEditing(false);
          }}
          className="flex flex-1 flex-wrap items-center gap-2"
        >
          <input type="hidden" name="id" value={id} />
          <input
            name="name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            autoFocus
            className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <SelectField
            name="kind"
            value={kindValue}
            onChange={(e) => setKindValue(e.target.value)}
            fullWidth={false}
            className="!rounded !py-1 !pl-2 !pr-6 !text-xs"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </SelectField>
          <button className="shrink-0 rounded-full bg-duty-purple px-3 py-1 text-xs font-medium text-white">
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setNameValue(name);
              setKindValue(kind);
              setError(null);
            }}
            className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
          {error && <p className="w-full text-xs text-duty-red">{error}</p>}
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left"
            title="Rename"
          >
            <span className="text-sm font-semibold hover:underline">{primary}</span>
            <p className="mt-0.5 text-xs text-neutral-500">
              {subtitle ?? kind.replace(/_/g, " ")}
              {addedByName && (
                <>
                  {" "}
                  · added by{" "}
                  <Link
                    href={`/u/${addedById}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {addedByName}
                  </Link>
                </>
              )}
            </p>
          </button>
          <DeleteDecisionMakerButton id={id} name={name} />
        </>
      )}
    </li>
  );
}
