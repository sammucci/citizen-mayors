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

// approveTagSuggestion and rejectTagSuggestion moved to
// proposals/actions.ts (v62) — import them from there now. Approving or
// rejecting a tag suggestion depends on whether the proposal's OWNER or
// an admin is doing it (and, for brand-new tags, a two-step
// owner-then-admin path), which needs the same proposal_id-scoped
// ownership check that already lives over there for approvePowerTreeNode.

// Edits one of the 7 founding budget categories in place — label,
// description, accent color, whether it requires a direct budget line,
// and its sort order on the homepage filter row. Deliberately edit-only:
// there's no add/delete counterpart, since this is meant to stay a
// small, deliberate fixed set rather than something that grows like tags
// or decision_makers. The slug is left alone on purpose — it's baked
// into existing filter links (/?category=slug) around the site, and
// changing it would silently break any of those still in use.
export async function updateCategory(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = Number(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const requiresBudget = formData.get("requires_budget") === "on";
  const sortOrderRaw = String(formData.get("sort_order") ?? "").trim();

  if (!label) return { error: "Category name can't be empty." };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: "Color needs to be a hex code, like #6C3FD1." };
  }

  const { error } = await supabase
    .from("categories")
    .update({
      label,
      description: description || null,
      color,
      requires_budget: requiresBudget,
      sort_order: sortOrderRaw ? Number(sortOrderRaw) : 0,
    })
    .eq("id", id);
  if (error) return { error: "Something went wrong updating that category." };

  revalidatePath("/admin/categories");
  revalidatePath("/");
  revalidatePath("/proposals/new");
  return {};
}

// Renames a real, already-approved tag in place — previously the tags
// table itself had no update/delete path from the admin panel at all,
// only the suggestion-approval queue (which creates NEW tags). The slug
// is regenerated from the new label so filter links (/?tag=slug) keep
// matching, same normalization approveTagSuggestion uses.
export async function renameTag(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Tag name can't be empty." };

  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const { error } = await supabase.from("tags").update({ label, slug }).eq("id", id);
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "That name (or its slug) is already used by another tag."
        : "Something went wrong renaming that tag.",
    };
  }

  revalidatePath("/admin/tags");
  revalidatePath("/");
  return {};
}

// Removes a tag from the shared registry entirely — proposal_tags rows
// referencing it are cleaned up automatically (on delete cascade in the
// schema), so a deleted tag just quietly disappears from any proposal
// that had it, rather than failing or orphaning anything.
export async function deleteTag(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return { error: "Something went wrong deleting that tag." };

  revalidatePath("/admin/tags");
  revalidatePath("/");
  return {};
}

// Lets an admin seed a project tag directly, instead of the only path
// in being someone suggesting it while writing a proposal and an admin
// later approving it. Same slug rule and duplicate-avoidance (case-
// insensitive label match) as approveTagSuggestion above, so a tag
// added here and one that arrives later via a suggestion can't end up
// as two rows for the same name.
export async function addTagAdmin(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Give it a name first." };

  const { data: existing } = await supabase.from("tags").select("id").ilike("label", label).maybeSingle();
  if (existing) return { error: "That tag already exists." };

  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const { error } = await supabase.from("tags").insert({ slug, label });
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "That name (or its slug) is already used by another tag."
        : "Something went wrong adding that tag.",
    };
  }

  revalidatePath("/admin/tags");
  return {};
}

// Groups (Pedestrian & Bike Safety, Housing, ...) are a small, curated
// list Samantha manages herself — unlike tags, this list never grows on
// its own from what people type. Assigning a tag to a group happens
// separately (setTagGroup below) so a brand-new tag can land ungrouped
// without blocking a suggestion approval or the admin "add tag" form.
export async function addTagGroup(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Give it a name first." };

  const { error } = await supabase.from("tag_groups").insert({ label });
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "That group already exists."
        : "Something went wrong adding that group.",
    };
  }

  revalidatePath("/admin/tags");
  return {};
}

export async function renameTagGroup(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Group name can't be empty." };

  const { error } = await supabase.from("tag_groups").update({ label }).eq("id", id);
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "That name's already used by another group."
        : "Something went wrong renaming that group.",
    };
  }

  revalidatePath("/admin/tags");
  return {};
}

// Deleting a group never deletes the tags underneath it — they just
// fall back to ungrouped (the foreign key is `on delete set null`),
// same reversible spirit as everything else in this admin panel.
export async function deleteTagGroup(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const { error } = await supabase.from("tag_groups").delete().eq("id", id);
  if (error) return { error: "Something went wrong deleting that group." };

  revalidatePath("/admin/tags");
  return {};
}

// Assigns (or clears, if group_id is empty) which group a single tag
// belongs to — the other half of "tags grow on their own, groups
// don't": this is how a tag actually gets sorted into one of Samantha's
// topics, whether it arrived via suggestion-approval or the admin "add
// tag" form.
export async function setTagGroup(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const groupIdRaw = String(formData.get("group_id") ?? "").trim();
  const groupId = groupIdRaw ? Number(groupIdRaw) : null;

  const { error } = await supabase.from("tags").update({ group_id: groupId }).eq("id", id);
  if (error) return { error: "Something went wrong updating that tag's group." };

  revalidatePath("/admin/tags");
  return {};
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

// Renames (and/or re-kinds) an entry in the shared decision-makers
// registry in place — previously a typo or wrong "kind" could only be
// fixed by deleting the entry and re-adding it, which fails outright if
// it's already in use in any proposal's decision chain. Same
// case-insensitive duplicate check as the "add new" flow, so a rename
// can't accidentally collide with another existing entry.
export async function renameDecisionMaker(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "other");
  if (!name) return { error: "Name can't be empty." };

  const { data: existing } = await supabase
    .from("decision_makers")
    .select("id")
    .ilike("name", name)
    .neq("id", id)
    .maybeSingle();
  if (existing) return { error: "Another entry already has that name." };

  const { error } = await supabase
    .from("decision_makers")
    .update({ name, kind })
    .eq("id", id);
  if (error) return { error: "Something went wrong renaming that entry." };

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

  revalidatePath("/admin/tags");
  return {};
}

// Recovery action for the "used in logs, but no longer a tag" section:
// an orphaned label is civic_logs.category text with no matching
// volunteer_categories row (almost always because the tag was deleted,
// or — as turned out to be the actual cause the first time this showed
// up — a near-duplicate got created with different capitalization,
// e.g. typing "Civic and Government" into the "add a log" combobox
// while the real tag was "Civic & Government", so the two never
// matched as the same tag).
//
// This does NOT always insert a new row. It first checks (case-
// insensitively) whether a tag already exists that's just a
// capitalization/spelling variant of this orphaned text. If so, it
// merges: every civic_logs row using the orphaned text gets bulk-
// updated to that existing tag's exact label (same cascade
// renameVolunteerCategory already does), so the hours join the
// existing tag instead of creating a duplicate. Only if nothing close
// enough already exists does it create a brand-new tag, same as before.
// Previously this just called addVolunteerCategoryAdmin directly and
// silently discarded its {error?} result to satisfy the plain <form
// action={fn}> void-return requirement — which meant clicking "add
// back as a tag" did nothing and gave no clue why, in exactly this
// already-exists case.
export async function resolveOrphanedVolunteerCategory(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  const { data: existingTag } = await supabase
    .from("volunteer_categories")
    .select("id, label")
    .ilike("label", label)
    .maybeSingle();

  if (existingTag) {
    if (existingTag.label !== label) {
      await supabase.from("civic_logs").update({ category: existingTag.label }).eq("category", label);
    }
  } else {
    await supabase.from("volunteer_categories").insert({ label });
  }

  revalidatePath("/admin/tags");
  revalidatePath("/profile");
  revalidatePath("/community-dashboard");
}

// Renames a category label in place. Past civic_logs rows store the
// category as plain text (not a foreign key from category), so a rename
// here doesn't automatically follow through to them — this explicitly
// updates every existing civic_logs row that had the OLD label to the
// new one, so a correction (fixing capitalization, a typo) shows up
// everywhere that category is displayed: someone's own log, their
// report card, and the community dashboard's "hours by category." A
// rename that just merges two near-duplicates into one label is treated
// the same way, on purpose — their hours combine under the corrected
// name.
export async function renameVolunteerCategory(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Category name can't be empty." };

  const { data: current } = await supabase
    .from("volunteer_categories")
    .select("label")
    .eq("id", id)
    .maybeSingle();
  const oldLabel = current?.label ?? null;

  const { error } = await supabase.from("volunteer_categories").update({ label }).eq("id", id);
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "That name's already used by another category."
        : "Something went wrong renaming that category.",
    };
  }

  if (oldLabel && oldLabel !== label) {
    await supabase.from("civic_logs").update({ category: label }).eq("category", oldLabel);
  }

  revalidatePath("/admin/tags");
  revalidatePath("/profile");
  revalidatePath("/community-dashboard");
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

  revalidatePath("/admin/tags");
  return {};
}

// Groups (Environmental, Animals, Social Impact, ...) are a small,
// curated list Samantha manages herself — unlike volunteer_categories,
// this list never grows on its own from what people type. Assigning a
// tag to a group happens separately (setVolunteerCategoryGroup below) so
// a brand-new tag can land ungrouped without blocking anyone's form.
export async function addVolunteerCategoryGroup(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Give it a name first." };

  const { error } = await supabase.from("volunteer_category_groups").insert({ label });
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "That group already exists."
        : "Something went wrong adding that group.",
    };
  }

  revalidatePath("/admin/tags");
  return {};
}

export async function renameVolunteerCategoryGroup(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Group name can't be empty." };

  const { error } = await supabase.from("volunteer_category_groups").update({ label }).eq("id", id);
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "That name's already used by another group."
        : "Something went wrong renaming that group.",
    };
  }

  revalidatePath("/admin/tags");
  return {};
}

// Deleting a group never deletes the tags underneath it — they just
// fall back to ungrouped (the foreign key is `on delete set null`),
// same reversible spirit as everything else in this admin panel.
export async function deleteVolunteerCategoryGroup(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const { error } = await supabase.from("volunteer_category_groups").delete().eq("id", id);
  if (error) return { error: "Something went wrong deleting that group." };

  revalidatePath("/admin/tags");
  return {};
}

// Assigns (or clears, if group_id is empty) which group a single tag
// belongs to — the other half of "tags grow on their own, groups don't":
// this is how a freshly-typed tag actually gets sorted into one of
// Samantha's buckets.
export async function setVolunteerCategoryGroup(formData: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();

  const id = String(formData.get("id"));
  const groupIdRaw = String(formData.get("group_id") ?? "").trim();
  const groupId = groupIdRaw ? Number(groupIdRaw) : null;

  const { error } = await supabase
    .from("volunteer_categories")
    .update({ group_id: groupId })
    .eq("id", id);
  if (error) return { error: "Something went wrong updating that category's group." };

  revalidatePath("/admin/tags");
  return {};
}
