"use client";

import { useState } from "react";
import {
  deleteVolunteerCategory,
  renameVolunteerCategory,
  setVolunteerCategoryGroup,
} from "@/app/admin/actions";
import { SelectField } from "@/components/select-field";

// Inline rename (click the label to edit it in place) plus the same
// two-step "are you sure" delete confirm used for decision-makers.
// Renaming here now ALSO updates every past civic_logs row that used
// the old text (see renameVolunteerCategory), so a correction shows up
// everywhere that category is displayed, not just in future entries.
// The group dropdown is the other half of the grouping feature: tags
// grow on their own as people type them, but which curated group (if
// any) a tag belongs to is something only an admin sets, here.
export function VolunteerCategoryRow({
  id,
  label,
  groupId,
  groups,
}: {
  id: string;
  label: string;
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
              const result = await renameVolunteerCategory(formData);
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
              className="text-sm font-medium text-neutral-800 hover:underline"
              title="Rename"
            >
              {label}
            </button>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-duty-red hover:text-duty-red"
              >
                Delete
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-neutral-500">Delete "{label}"?</span>
                <button
                  type="button"
                  onClick={async () => {
                    setError(null);
                    const fd = new FormData();
                    fd.set("id", id);
                    const result = await deleteVolunteerCategory(fd);
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
            )}
          </>
        )}
      </div>
      {!editing && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-neutral-400">Group</span>
          <SelectField
            defaultValue={groupId ?? ""}
            disabled={savingGroup}
            onChange={async (e) => {
              setSavingGroup(true);
              setError(null);
              const fd = new FormData();
              fd.set("id", id);
              fd.set("group_id", e.target.value);
              const result = await setVolunteerCategoryGroup(fd);
              if (result?.error) setError(result.error);
              setSavingGroup(false);
            }}
            fullWidth={false}
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
