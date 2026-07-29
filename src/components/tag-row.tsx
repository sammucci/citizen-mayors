"use client";

import { useState } from "react";
import { deleteTag, renameTag, setTagGroup } from "@/app/admin/actions";
import { SelectField } from "@/components/select-field";

// Same inline-rename-plus-confirm-delete pattern as VolunteerCategoryRow
// and DecisionMakerRow — the tags table previously had no admin edit
// path at all (only the suggestion-approval queue, which only ever
// creates new ones). The group dropdown is the other half of the
// tag-groups feature: tags grow on their own (suggested + approved, or
// added directly here), but which curated topic (if any) a tag belongs
// to is something only an admin sets, here — same split as
// VolunteerCategoryRow's group picker.
export function TagRow({
  id,
  label,
  usageCount,
  groupId,
  groups,
}: {
  id: string;
  label: string;
  usageCount: number;
  groupId: string | null;
  groups: { id: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <form
            action={async (formData) => {
              setError(null);
              const result = await renameTag(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              setEditing(false);
            }}
            className="flex flex-1 items-center gap-2"
          >
            <input type="hidden" name="id" value={id} />
            <input
              name="label"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <button className="shrink-0 rounded-full bg-duty-purple px-3 py-1 text-xs font-medium text-white">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue(label);
                setError(null);
              }}
              className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-w-0 truncate text-left text-sm font-medium text-neutral-800 hover:underline"
              title="Rename"
            >
              #{label}
              <span className="ml-1.5 font-normal text-neutral-400">
                {usageCount} proposal{usageCount === 1 ? "" : "s"}
              </span>
            </button>
            {!confirmingDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-duty-red hover:text-duty-red"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
      {/* Its own full-width block below the row, not squeezed onto the
          same line as the label — this card can be as narrow as one of
          3-4 in a grid row now, and "Delete "label" (used on N)? Confirm
          Cancel" all on one line doesn't fit at that width (the confirm
          and cancel buttons were getting pushed out of view entirely). */}
      {!editing && confirmingDelete && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md bg-neutral-50 p-2">
          <span className="text-xs text-neutral-500">
            Delete "{label}"{usageCount > 0 ? ` (used on ${usageCount})` : ""}?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                const fd = new FormData();
                fd.set("id", id);
                const result = await deleteTag(fd);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                setConfirmingDelete(false);
              }}
              className="shrink-0 rounded-full bg-duty-red px-3 py-1 text-xs font-medium text-white"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {!editing && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-neutral-400">Topic</span>
          <SelectField
            defaultValue={groupId ?? ""}
            disabled={savingGroup}
            onChange={async (e) => {
              setSavingGroup(true);
              setError(null);
              const fd = new FormData();
              fd.set("id", id);
              fd.set("group_id", e.target.value);
              const result = await setTagGroup(fd);
              if (result?.error) setError(result.error);
              setSavingGroup(false);
            }}
            wrapperClassName="min-w-0 flex-1"
            className="!rounded !py-0.5 !pl-2 !pr-6 !text-xs !text-neutral-700"
          >
            <option value="">Ungrouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-duty-red">{error}</p>}
    </li>
  );
}
