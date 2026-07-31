"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateDecisionMakerStructuredFields,
  updateDecisionMakerWikiText,
  addDecisionMakerLegislation,
  deleteDecisionMakerLegislation,
} from "@/app/decision-makers/actions";

type ProfileFields = {
  office_title: string | null;
  party_affiliation: string | null;
  elected_date: string | null;
  term_end_date: string | null;
  next_election_date: string | null;
  represents_scope: "district" | "citywide" | "n/a";
  represents_district: number | null;
  committees: string[];
  how_they_show_up: string;
  what_they_care_about: string;
};

type LegislationRow = {
  id: string;
  title: string;
  stance: "introduced" | "for" | "against";
  note: string | null;
  occurred_on: string | null;
  addedByName: string;
  addedById: string | null;
};

const DISTRICTS = Array.from({ length: 10 }, (_, i) => i + 1);

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Every wiki-style edit on this page is anyone-signed-in, not just the
// proposal owner or the person who first added this decision-maker —
// that's Samantha's explicit ask ("these profiles are by the people").
// This one client component owns all of the profile's editable pieces
// (structured fields, the two wiki-text sections, legislation) so the
// server page itself can stay a plain data-fetch-and-hand-off.
export function DecisionMakerProfileEditor({
  decisionMakerId,
  canEdit,
  isAdmin,
  currentUserId,
  profile,
  legislation,
}: {
  decisionMakerId: string;
  canEdit: boolean;
  isAdmin: boolean;
  currentUserId: string | null;
  profile: ProfileFields;
  legislation: LegislationRow[];
}) {
  const router = useRouter();
  const [editingFields, setEditingFields] = useState(false);
  const [editingShowUp, setEditingShowUp] = useState(false);
  const [editingCareAbout, setEditingCareAbout] = useState(false);
  const [addingLegislation, setAddingLegislation] = useState(false);

  const stanceLabel = { introduced: "Introduced", for: "Voted/fought for", against: "Voted/fought against" };
  const stanceColor = {
    introduced: "bg-neutral-100 text-neutral-700",
    for: "bg-green-100 text-green-800",
    against: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      {/* Structured fields */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Office details
          </p>
          {canEdit && !editingFields && (
            <button
              type="button"
              onClick={() => setEditingFields(true)}
              className="text-xs text-duty-purple underline"
            >
              Edit
            </button>
          )}
        </div>

        {!editingFields ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-400">Office / title</dt>
              <dd>{profile.office_title || "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Party affiliation</dt>
              <dd>{profile.party_affiliation || "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Represents</dt>
              <dd>
                {profile.represents_scope === "citywide"
                  ? "Citywide (all districts)"
                  : profile.represents_scope === "district" && profile.represents_district
                  ? `District ${profile.represents_district}`
                  : "Not added yet"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Committees</dt>
              <dd>{profile.committees.length > 0 ? profile.committees.join(", ") : "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Elected</dt>
              <dd>{formatDate(profile.elected_date) || "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Term ends</dt>
              <dd>{formatDate(profile.term_end_date) || "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Next election</dt>
              <dd>{formatDate(profile.next_election_date) || "Not added yet"}</dd>
            </div>
          </dl>
        ) : (
          <form
            action={async (formData) => {
              await updateDecisionMakerStructuredFields(formData);
              router.refresh();
              setEditingFields(false);
            }}
            className="mt-2 space-y-2"
          >
            <input type="hidden" name="decision_maker_id" value={decisionMakerId} />
            <label className="block text-xs text-neutral-600">
              Office / title
              <input
                name="office_title"
                defaultValue={profile.office_title ?? ""}
                placeholder="e.g. Councilmember, 5th District"
                className="input mt-0.5 text-sm"
              />
            </label>
            <label className="block text-xs text-neutral-600">
              Party affiliation
              <input
                name="party_affiliation"
                defaultValue={profile.party_affiliation ?? ""}
                placeholder="e.g. Democrat, Republican, Working Families"
                className="input mt-0.5 text-sm"
              />
            </label>
            <label className="block text-xs text-neutral-600">
              Committees (comma-separated)
              <input
                name="committees"
                defaultValue={profile.committees.join(", ")}
                placeholder="e.g. Rules, Public Safety"
                className="input mt-0.5 text-sm"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-xs text-neutral-600">
                Elected
                <input type="date" name="elected_date" defaultValue={profile.elected_date ?? ""} className="input mt-0.5 text-sm" />
              </label>
              <label className="block text-xs text-neutral-600">
                Term ends
                <input type="date" name="term_end_date" defaultValue={profile.term_end_date ?? ""} className="input mt-0.5 text-sm" />
              </label>
              <label className="block text-xs text-neutral-600">
                Next election
                <input type="date" name="next_election_date" defaultValue={profile.next_election_date ?? ""} className="input mt-0.5 text-sm" />
              </label>
            </div>
            <div>
              <p className="text-xs text-neutral-600">Who they represent</p>
              <div className="mt-1 flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs">
                  <input type="radio" name="represents_scope" value="citywide" defaultChecked={profile.represents_scope === "citywide"} />
                  Citywide
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="radio" name="represents_scope" value="district" defaultChecked={profile.represents_scope === "district"} />
                  A district
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="radio" name="represents_scope" value="n/a" defaultChecked={profile.represents_scope === "n/a"} />
                  N/A
                </label>
                <select name="represents_district" defaultValue={profile.represents_district ?? ""} className="input w-auto text-xs">
                  <option value="">—</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      District {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded bg-duty-purple px-3 py-1 text-xs font-medium text-white">Save</button>
              <button
                type="button"
                onClick={() => setEditingFields(false)}
                className="rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Wiki text: how they show up */}
      <WikiTextBlock
        title="How they actually show up"
        hint="Real experience from residents — not the official bio. What have you actually seen from them in the community?"
        field="how_they_show_up"
        value={profile.how_they_show_up}
        decisionMakerId={decisionMakerId}
        canEdit={canEdit}
        editing={editingShowUp}
        setEditing={setEditingShowUp}
        router={router}
      />

      {/* Wiki text: what they care about */}
      <WikiTextBlock
        title="What they actually care about"
        hint="Based on real interactions and record, not press releases."
        field="what_they_care_about"
        value={profile.what_they_care_about}
        decisionMakerId={decisionMakerId}
        canEdit={canEdit}
        editing={editingCareAbout}
        setEditing={setEditingCareAbout}
        router={router}
      />

      {/* Legislation */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Legislation
          </p>
          {canEdit && !addingLegislation && (
            <button
              type="button"
              onClick={() => setAddingLegislation(true)}
              className="text-xs text-duty-purple underline"
            >
              + Add
            </button>
          )}
        </div>

        {addingLegislation && (
          <form
            action={async (formData) => {
              await addDecisionMakerLegislation(formData);
              router.refresh();
              setAddingLegislation(false);
            }}
            className="mt-2 space-y-1.5 rounded border border-dashed border-neutral-300 bg-neutral-50 p-2"
          >
            <input type="hidden" name="decision_maker_id" value={decisionMakerId} />
            <input name="title" required placeholder="Bill / legislation title" className="input text-xs" />
            <div className="flex gap-2">
              <select name="stance" className="input w-auto text-xs">
                <option value="introduced">Introduced</option>
                <option value="for">Voted/fought for</option>
                <option value="against">Voted/fought against</option>
              </select>
              <input type="date" name="occurred_on" className="input w-auto text-xs" />
            </div>
            <input name="note" placeholder="Optional note" className="input text-xs" />
            <div className="flex gap-2">
              <button className="rounded bg-duty-purple px-3 py-1 text-xs font-medium text-white">Add</button>
              <button
                type="button"
                onClick={() => setAddingLegislation(false)}
                className="rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <ul className="mt-2 space-y-1.5">
          {legislation.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-2 rounded bg-neutral-50 p-2 text-xs">
              <div>
                <span className={`mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${stanceColor[l.stance]}`}>
                  {stanceLabel[l.stance]}
                </span>
                <span className="font-medium">{l.title}</span>
                {l.note && <p className="mt-0.5 text-neutral-500">{l.note}</p>}
                <p className="mt-0.5 text-neutral-400">
                  {formatDate(l.occurred_on) ?? "Undated"} · added by {l.addedByName}
                </p>
              </div>
              {(isAdmin || l.addedById === currentUserId) && (
                <form
                  action={async (formData) => {
                    await deleteDecisionMakerLegislation(formData);
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="decision_maker_id" value={decisionMakerId} />
                  <input type="hidden" name="legislation_id" value={l.id} />
                  <button className="shrink-0 text-neutral-400 hover:text-duty-red" title="Remove">
                    ✕
                  </button>
                </form>
              )}
            </li>
          ))}
          {legislation.length === 0 && (
            <li className="text-xs text-neutral-400">Nothing logged yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function WikiTextBlock({
  title,
  hint,
  field,
  value,
  decisionMakerId,
  canEdit,
  editing,
  setEditing,
  router,
}: {
  title: string;
  hint: string;
  field: "how_they_show_up" | "what_they_care_about";
  value: string;
  decisionMakerId: string;
  canEdit: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
          <p className="text-[11px] text-neutral-400">{hint}</p>
        </div>
        {canEdit && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-xs text-duty-purple underline">
            Edit
          </button>
        )}
      </div>
      {!editing ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
          {value || "Nothing added yet — be the first to share what you know."}
        </p>
      ) : (
        <form
          action={async (formData) => {
            await updateDecisionMakerWikiText(formData);
            router.refresh();
            setEditing(false);
          }}
          className="mt-2 space-y-1.5"
        >
          <input type="hidden" name="decision_maker_id" value={decisionMakerId} />
          <input type="hidden" name="field" value={field} />
          <textarea name="value" defaultValue={value} rows={4} autoFocus className="input text-sm" />
          <div className="flex gap-2">
            <button className="rounded bg-duty-purple px-3 py-1 text-xs font-medium text-white">Save</button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
