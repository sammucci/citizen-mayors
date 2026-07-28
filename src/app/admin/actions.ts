"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Same shape as requireUser() in proposals/actions.ts, plus the admin
// check. Checked here in the action itself, not just relied on via RLS —
// RLS is what actually stops a non-admin's write from taking effect, but
// failing early with a clear error is friendlier than a silent no-op.
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    throw new Error("Admin only.");
  }
  return { supabase, user };
}

// Turns a pending suggestion into a real tag: creates the row in the
// shared `tags` table (reusing it if a tag with that exact label
// already exists — someone may have suggested a near-duplicate before
// this one got reviewed), attaches it to the proposal that prompted the
// suggestion, and marks the suggestion approved.
export async function approveTagSuggestion(formData: FormData) {
  const { supabase } = await requireAdmin();

  const suggestionId = String(formData.get("suggestion_id"));
  const proposalId = String(formData.get("proposal_id"));
  const label = String(formData.get("label"));
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const { data: existingTag } = await supabase
    .from("tags")
    .select("id")
    .ilike("label", label)
    .maybeSingle();

  let tagId = existingTag?.id;
  if (!tagId) {
    const { data: newTag, error } = await supabase
      .from("tags")
      .insert({ slug, label })
      .select("id")
      .single();
    if (error) throw error;
    tagId = newTag.id;
  }

  await supabase
    .from("proposal_tags")
    .upsert(
      { proposal_id: proposalId, tag_id: tagId },
      { onConflict: "proposal_id,tag_id", ignoreDuplicates: true }
    );

  await supabase
    .from("tag_suggestions")
    .update({ status: "approved" })
    .eq("id", suggestionId);

  revalidatePath("/admin/tag-suggestions");
  revalidatePath(`/proposals/${proposalId}`);
}

export async function rejectTagSuggestion(formData: FormData) {
  const { supabase } = await requireAdmin();

  const suggestionId = String(formData.get("suggestion_id"));
  const proposalId = String(formData.get("proposal_id"));

  await supabase
    .from("tag_suggestions")
    .update({ status: "rejected" })
    .eq("id", suggestionId);

  revalidatePath("/admin/tag-suggestions");
  revalidatePath(`/proposals/${proposalId}`);
}

// Same normalization as the "add new" flow in the decision-maker
// combobox (proposals/actions.ts) — kept as its own small copy here
// rather than a shared import, matching how the other small per-file
// helpers (like isNonEmptyFile) are already handled in this codebase.
function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|\s|-|')([a-z])/g, (_match, sep, letter) => sep + letter.toUpperCase());
}

// Lets an admin add straight to the shared decision-makers registry —
// previously the only way in was the "add new" combobox option while
// building a specific proposal's chain. Same duplicate-avoidance as
// that flow: a case-insensitive name match reuses the existing row
// instead of creating a near-duplicate.
export async function addDecisionMakerAdmin(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireAdmin();

  const rawName = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "other");
  if (!rawName) return { error: "Give it a name first." };

  const { data: existing } = await supabase
    .from("decision_makers")
    .select("id")
    .ilike("name", rawName)
    .maybeSingle();
  if (existing) {
    return { error: "That's already in the registry." };
  }

  const { error } = await supabase
    .from("decision_makers")
    .insert({ name: toTitleCase(rawName), kind, added_by: user.id });
  if (error) {
    return { error: "Something went wrong adding that entry." };
  }

  revalidatePath("/admin/decision-makers");
  return {};
}

// Removes an entry from the shared decision-makers registry — typos,
// duplicates (e.g. a stray lowercase "quetcy lozada" next to the real
// "Quetcy Lozada"), anything that shouldn't be an option anymore.
// Anyone signed in can add to this registry, but only an admin can
// remove from it. If it's currently in use in any proposal's decision
// chain, the delete fails on the foreign key rather than silently
// orphaning that proposal's data — the caller surfaces that as a
// friendly message instead of a crash.
export async function deleteDecisionMaker(
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const decisionMakerId = String(formData.get("decision_maker_id"));

  const { error } = await supabase
    .from("decision_makers")
    .delete()
    .eq("id", decisionMakerId);

  if (error) {
    return {
      error: /foreign key|violates/i.test(error.message)
        ? "Can't delete — it's currently used in at least one proposal's decision chain. Remove it from those first."
        : "Something went wrong deleting that entry.",
    };
  }

  revalidatePath("/admin/decision-makers");
  return {};
}

// The volunteer-category registry (Environment, Youth, Food security,
// etc.) — same shared, crowdsourced idea as decision_makers, but there's
// no foreign key from civic_logs.category back to it (category is
// stored as plain text on each log entry), so renaming or deleting here
// never touches, orphans, or breaks any past log entry. It only changes
// what shows up as a suggestion the next time someone logs hours.
export async function addVolunteerCategoryAdmin(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Give it a name first." };

  const { data: existing } = await supabase
    .from("volunteer_categories")
    .select("id")
    .ilike("label", label)
    .maybeSingle();
  if (existing) return { error: "That category already exists." };

  const { error } = await supabase.from("volunteer_categories").insert({ label });
  if (error) return { error: "Something went wrong adding that category." };

  revalidatePath("/admin/volunteer-categories");
  return {};
}

// Renames a category label in place — every past civic_logs row that
// used the old text stays exactly as it was (it's plain text, not a
// foreign key), so this only changes what future entries pick from,
// not history.
export async function renameVolunteerCategory(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Category name can't be empty." };

  const { error } = await supabase.from("volunteer_categories").update({ label }).eq("id", id);
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "That name's already used by another category."
        : "Something went wrong renaming that category.",
    };
  }

  revalidatePath("/admin/volunteer-categories");
  return {};
}

// Blocks or unblocks a member from posting. This only stops NEW writes
// (every proposals/actions.ts action checks is_blocked via
// requireUser()) — it deliberately does not hide, unpublish, or delete
// anything the person already posted, matching the reversible/
// non-destructive approach used for proposals in this same round. An
// admin can't block themselves out from here (own row excluded in the
// UI) to avoid an easy self-lockout.
export async function toggleMemberBlocked(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const memberId = String(formData.get("member_id"));
  const nextBlocked = formData.get("blocked") === "true";

  const { error } = await supabase
    .from("profiles")
    .update({ is_blocked: nextBlocked })
    .eq("id", memberId);
  if (error) return { error: "Something went wrong updating that member." };

  revalidatePath("/admin/members");
  return {};
}

export async function deleteVolunteerCategory(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const { error } = await supabase.from("volunteer_categories").delete().eq("id", id);
  if (error) return { error: "Something went wrong deleting that category." };

  revalidatePath("/admin/volunteer-categories");
  return {};
}
