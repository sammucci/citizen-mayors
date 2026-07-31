"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COUNCIL_COMMITTEES } from "@/lib/council-committees";

type CommitteeAssignment = { name: string; role: "chair" | "vice_chair" | "member" };
const COMMITTEE_ROLES = ["chair", "vice_chair", "member"] as const;
const ROLE_LABEL: Record<CommitteeAssignment["role"], string> = { chair: "Chair", vice_chair: "Vice Chair", member: "Member" };

function formatCommittees(committees: CommitteeAssignment[] | null | undefined): string | null {
  if (!committees || committees.length === 0) return null;
  return committees.map((c) => (c.role === "member" ? c.name : `${c.name} (${ROLE_LABEL[c.role]})`)).join(", ");
}

// Same pattern as proposals/actions.ts's requireUser — redirect() instead
// of throw so a signed-out visitor lands on /login instead of Next's
// generic crash screen, and blocked members can't write here either.
async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_blocked, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_blocked) {
    throw new Error("Your account has been blocked from posting. Contact the site admin if you think this is a mistake.");
  }

  return { supabase, user, isAdmin: Boolean(profile?.is_admin) };
}

// Every wiki-style edit funnels through here so the accountability trail
// (decision_maker_revisions) can never be forgotten on some new field
// later — one call logs it, whatever the field, comparing old vs. new
// as a plain string (good enough for "what changed and who changed it,"
// not a true character-by-character diff).
async function logRevision(
  supabase: ReturnType<typeof createClient>,
  decisionMakerId: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  editedBy: string
) {
  if ((oldValue ?? "") === (newValue ?? "")) return; // nothing actually changed
  await supabase.from("decision_maker_revisions").insert({
    decision_maker_id: decisionMakerId,
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
    edited_by: editedBy,
  });
}

// Upserts the structured fields (office/title, dates, who they represent,
// committees) in one go — the profile edit form submits all of them
// together rather than field-by-field, so this reads the existing row
// first (if any) purely to log what changed per-field, then writes the
// whole row in a single upsert.
export async function updateDecisionMakerStructuredFields(formData: FormData) {
  const { supabase, user } = await requireUser();
  const decisionMakerId = String(formData.get("decision_maker_id"));

  const currentOfficeholder = (formData.get("current_officeholder") as string | null)?.trim() || null;
  const officeTitle = (formData.get("office_title") as string | null)?.trim() || null;
  const partyAffiliation = (formData.get("party_affiliation") as string | null)?.trim() || null;
  const electedDate = (formData.get("elected_date") as string | null) || null;
  const termEndDate = (formData.get("term_end_date") as string | null) || null;
  const nextElectionDate = (formData.get("next_election_date") as string | null) || null;
  const representsScope = (formData.get("represents_scope") as string | null) || "n/a";
  const representsDistrictRaw = formData.get("represents_district") as string | null;
  const representsDistrict =
    representsScope === "district" && representsDistrictRaw ? Number(representsDistrictRaw) : null;
  // Each real committee gets its own indexed checkbox + role select (see
  // decision-maker-profile-editor.tsx) — read them back by the same
  // index the form rendered them at, so a checked box and its role stay
  // paired correctly. Anything typed into the "Other" freeform fallback
  // comes in as plain names and defaults to role "member".
  const checkedCommittees: CommitteeAssignment[] = [];
  COUNCIL_COMMITTEES.forEach((name, i) => {
    if (formData.get(`committee_${i}_checked`) !== "on") return;
    const roleRaw = formData.get(`committee_${i}_role`) as string | null;
    const role = (COMMITTEE_ROLES as readonly string[]).includes(roleRaw ?? "") ? (roleRaw as CommitteeAssignment["role"]) : "member";
    checkedCommittees.push({ name, role });
  });
  const otherCommittees: CommitteeAssignment[] = ((formData.get("committees_other") as string | null)
    ?.split(",")
    .map((c) => c.trim())
    .filter(Boolean) ?? []).map((name) => ({ name, role: "member" as const }));
  const committees = [...checkedCommittees, ...otherCommittees];

  const { data: existing } = await supabase
    .from("decision_maker_profiles")
    .select("current_officeholder, office_title, party_affiliation, elected_date, term_end_date, next_election_date, represents_scope, represents_district, committees")
    .eq("decision_maker_id", decisionMakerId)
    .maybeSingle();

  await supabase.from("decision_maker_profiles").upsert({
    decision_maker_id: decisionMakerId,
    current_officeholder: currentOfficeholder,
    office_title: officeTitle,
    party_affiliation: partyAffiliation,
    elected_date: electedDate,
    term_end_date: termEndDate,
    next_election_date: nextElectionDate,
    represents_scope: representsScope,
    represents_district: representsDistrict,
    committees,
    updated_at: new Date().toISOString(),
  });

  const fieldsToLog: [string, string | null, string | null][] = [
    ["current_officeholder", existing?.current_officeholder ?? null, currentOfficeholder],
    ["office_title", existing?.office_title ?? null, officeTitle],
    ["party_affiliation", existing?.party_affiliation ?? null, partyAffiliation],
    ["elected_date", existing?.elected_date ?? null, electedDate],
    ["term_end_date", existing?.term_end_date ?? null, termEndDate],
    ["next_election_date", existing?.next_election_date ?? null, nextElectionDate],
    ["represents_scope", existing?.represents_scope ?? null, representsScope],
    [
      "represents_district",
      existing?.represents_district != null ? String(existing.represents_district) : null,
      representsDistrict != null ? String(representsDistrict) : null,
    ],
    [
      "committees",
      formatCommittees(existing?.committees as CommitteeAssignment[] | null | undefined),
      formatCommittees(committees),
    ],
  ];
  for (const [field, oldVal, newVal] of fieldsToLog) {
    await logRevision(supabase, decisionMakerId, field, oldVal, newVal, user.id);
  }

  revalidatePath(`/decision-makers/${decisionMakerId}`);
}

// The two open wiki-text sections ("how they actually show up" / "what
// they actually care about") are edited one at a time, each its own
// small form — field says which column, matching the two allowed on the
// table, checked against an allowlist so this can't be pointed at an
// arbitrary column.
const WIKI_TEXT_FIELDS = ["how_they_show_up", "what_they_care_about"] as const;

export async function updateDecisionMakerWikiText(formData: FormData) {
  const { supabase, user } = await requireUser();
  const decisionMakerId = String(formData.get("decision_maker_id"));
  const field = String(formData.get("field"));
  const value = String(formData.get("value") ?? "");

  if (!WIKI_TEXT_FIELDS.includes(field as (typeof WIKI_TEXT_FIELDS)[number])) {
    throw new Error("Unknown profile field.");
  }

  const { data: existing } = await supabase
    .from("decision_maker_profiles")
    .select(field)
    .eq("decision_maker_id", decisionMakerId)
    .maybeSingle();

  await supabase.from("decision_maker_profiles").upsert({
    decision_maker_id: decisionMakerId,
    [field]: value,
    updated_at: new Date().toISOString(),
  });

  await logRevision(
    supabase,
    decisionMakerId,
    field,
    (existing as any)?.[field] ?? null,
    value,
    user.id
  );

  revalidatePath(`/decision-makers/${decisionMakerId}`);
}

export async function addDecisionMakerLegislation(formData: FormData) {
  const { supabase, user } = await requireUser();
  const decisionMakerId = String(formData.get("decision_maker_id"));
  const title = String(formData.get("title") ?? "").trim();
  const stance = String(formData.get("stance") ?? "introduced");
  const note = (formData.get("note") as string | null)?.trim() || null;
  const occurredOn = (formData.get("occurred_on") as string | null) || null;

  if (!title) return;

  await supabase.from("decision_maker_legislation").insert({
    decision_maker_id: decisionMakerId,
    title,
    stance,
    note,
    occurred_on: occurredOn,
    added_by: user.id,
  });

  await logRevision(supabase, decisionMakerId, "legislation:add", null, title, user.id);

  revalidatePath(`/decision-makers/${decisionMakerId}`);
}

// Anyone can fix a typo on someone else's legislation entry (wiki model,
// see decision_maker_legislation's update policy), but removing one
// entirely is narrower — either the person who added it, or an admin,
// same "you can undo your own work, or a moderator can undo anyone's"
// shape used for tags/decision-makers elsewhere on the site.
export async function deleteDecisionMakerLegislation(formData: FormData) {
  const { supabase, user, isAdmin } = await requireUser();
  const legislationId = String(formData.get("legislation_id"));
  const decisionMakerId = String(formData.get("decision_maker_id"));

  const { data: row } = await supabase
    .from("decision_maker_legislation")
    .select("added_by, title")
    .eq("id", legislationId)
    .maybeSingle();

  if (!row) return;
  if (row.added_by !== user.id && !isAdmin) {
    throw new Error("Only the person who added this, or an admin, can remove it.");
  }

  await supabase.from("decision_maker_legislation").delete().eq("id", legislationId);
  await logRevision(supabase, decisionMakerId, "legislation:remove", row.title, null, user.id);

  revalidatePath(`/decision-makers/${decisionMakerId}`);
}
