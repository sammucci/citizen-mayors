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
