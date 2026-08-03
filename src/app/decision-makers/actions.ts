"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inferRepresents } from "@/lib/decision-maker-represents";

// "vice_chair" is still a valid stored value (kept for any rows saved
// while that option briefly existed in the editor) even though the
// current picker only ever writes "member" or "chair".
type CommitteeAssignment = { name: string; role: "chair" | "vice_chair" | "member" };
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
  let representsScope = (formData.get("represents_scope") as string | null) || "n/a";
  const representsDistrictRaw = formData.get("represents_district") as string | null;
  let representsDistrict =
    representsScope === "district" && representsDistrictRaw ? Number(representsDistrictRaw) : null;

  // For a seat whose name already says who it represents ("Councilmember,
  // District 3"), that's derived from the name and overrides whatever was
  // submitted — not just hidden in the editor, but enforced here too, so
  // this can't drift out of sync with the seat's own title no matter how
  // the request was made. See decision-maker-represents.ts.
  const { data: decisionMaker } = await supabase
    .from("decision_makers")
    .select("name")
    .eq("id", decisionMakerId)
    .maybeSingle();
  const inferred = decisionMaker ? inferRepresents(decisionMaker.name) : null;
  if (inferred) {
    representsScope = inferred.scope;
    representsDistrict = inferred.district;
  }
  // Committee rows are added on demand in the editor (see
  // decision-maker-profile-editor.tsx), so there's no fixed number of
  // them to loop over — scan the submitted fields for however many rows
  // (committee_0_name/_role, committee_1_name/_role, ...) actually came
  // through instead of assuming a count.
  const committees: CommitteeAssignment[] = [];
  for (const key of formData.keys()) {
    const match = key.match(/^committee_(\d+)_name$/);
    if (!match) continue;
    const name = (formData.get(key) as string | null)?.trim();
    if (!name) continue;
    const roleRaw = formData.get(`committee_${match[1]}_role`) as string | null;
    const role: CommitteeAssignment["role"] = roleRaw === "chair" ? "chair" : "member";
    committees.push({ name, role });
  }

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

function isNonEmptyFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).arrayBuffer === "function" &&
    typeof (value as any).size === "number" &&
    (value as any).size > 0
  );
}

// Same upload shape as updateAvatar (src/app/actions.ts) — fixed path
// per decision-maker (upsert:true) so re-uploading replaces instead of
// piling up, cache-busted public URL, {error?} return instead of
// throwing. Wide-open (any signed-in user), same as every other field
// on this profile — the revision log is the accountability mechanism,
// not a narrower upload gate.
export async function updateDecisionMakerPhoto(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const decisionMakerId = String(formData.get("decision_maker_id"));

  const file = formData.get("photo");
  if (!isNonEmptyFile(file)) {
    return { error: "Choose an image file first." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${decisionMakerId}/photo.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("decision-maker-photos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) {
    console.error("updateDecisionMakerPhoto: storage upload failed", uploadError);
    const msg = uploadError.message ?? "";
    if (/size|large|payload|413/i.test(msg)) {
      return { error: "Your image is too big — try a smaller file (under 20MB)." };
    }
    return { error: "That image couldn't be uploaded. Try a different file." };
  }

  const { data: pub } = supabase.storage.from("decision-maker-photos").getPublicUrl(path);
  const photoUrl = `${pub.publicUrl}?t=${Date.now()}`;

  const { data: existing } = await supabase
    .from("decision_maker_profiles")
    .select("photo_url")
    .eq("decision_maker_id", decisionMakerId)
    .maybeSingle();

  const { error: updateError } = await supabase.from("decision_maker_profiles").upsert({
    decision_maker_id: decisionMakerId,
    photo_url: photoUrl,
    updated_at: new Date().toISOString(),
  });
  if (updateError) {
    console.error("updateDecisionMakerPhoto: saving photo_url failed", updateError);
    return { error: "Photo uploaded, but saving it to the profile failed. Try again." };
  }

  await logRevision(supabase, decisionMakerId, "photo", existing?.photo_url ? "had a photo" : null, "added a photo", user.id);

  revalidatePath(`/decision-makers/${decisionMakerId}`);
  return {};
}

export async function removeDecisionMakerPhoto(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const decisionMakerId = String(formData.get("decision_maker_id"));

  const { error } = await supabase
    .from("decision_maker_profiles")
    .update({ photo_url: null, updated_at: new Date().toISOString() })
    .eq("decision_maker_id", decisionMakerId);
  if (error) return { error: "Something went wrong removing that photo." };

  await logRevision(supabase, decisionMakerId, "photo", "had a photo", null, user.id);

  revalidatePath(`/decision-makers/${decisionMakerId}`);
  return {};
}

// Issue tags — existing-tag-only (see migration_dm_org_photos_and_issue_
// tags.sql for why there's no "suggest a brand-new tag" flow here: no
// owner concept on a decision-maker means no first-tier approver for
// the usual owner-then-admin new-tag flow). Attaching an existing tag
// needs no approval at all, same trust level as a proposal_grants
// lead — this is "known to be active on," not a claim of anyone's
// actual position or support.
const MAX_ISSUE_TAGS_PER_DECISION_MAKER = 10; // same cap as MAX_TAGS_PER_PROPOSAL, same reasoning (card/list legibility)

export async function attachDecisionMakerTag(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const decisionMakerId = String(formData.get("decision_maker_id"));
  const tagId = Number(formData.get("tag_id"));
  if (!tagId) return { error: "Pick a tag first." };

  const { count } = await supabase
    .from("decision_maker_tags")
    .select("*", { count: "exact", head: true })
    .eq("decision_maker_id", decisionMakerId);
  if ((count ?? 0) >= MAX_ISSUE_TAGS_PER_DECISION_MAKER) {
    return { error: `Already at the max of ${MAX_ISSUE_TAGS_PER_DECISION_MAKER} issue tags — remove one before adding another.` };
  }

  const { data: tag } = await supabase.from("tags").select("label").eq("id", tagId).maybeSingle();

  const { error } = await supabase
    .from("decision_maker_tags")
    .insert({ decision_maker_id: decisionMakerId, tag_id: tagId, added_by: user.id });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { error: "That tag's already attached." };
    return { error: "Something went wrong attaching that tag." };
  }

  await logRevision(supabase, decisionMakerId, "issue_tag:add", null, tag?.label ?? String(tagId), user.id);

  revalidatePath(`/decision-makers/${decisionMakerId}`);
  return {};
}

// Same "you can undo your own work, or a moderator can undo anyone's"
// shape as deleteDecisionMakerLegislation above.
export async function removeDecisionMakerTag(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user, isAdmin } = await requireUser();
  const decisionMakerId = String(formData.get("decision_maker_id"));
  const tagId = Number(formData.get("tag_id"));

  const { data: row } = await supabase
    .from("decision_maker_tags")
    .select("added_by, tags ( label )")
    .eq("decision_maker_id", decisionMakerId)
    .eq("tag_id", tagId)
    .maybeSingle();
  if (!row) return {};
  if ((row as any).added_by !== user.id && !isAdmin) {
    return { error: "Only whoever added this tag, or an admin, can remove it." };
  }

  await supabase.from("decision_maker_tags").delete().eq("decision_maker_id", decisionMakerId).eq("tag_id", tagId);
  await logRevision(supabase, decisionMakerId, "issue_tag:remove", (row as any).tags?.label ?? String(tagId), null, user.id);

  revalidatePath(`/decision-makers/${decisionMakerId}`);
  return {};
}
