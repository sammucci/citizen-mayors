"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to sign in first.");
  return { supabase, user };
}

export async function createProposal(formData: FormData) {
  const { supabase, user } = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "policy");
  const categoryId = Number(formData.get("category_id"));
  const summary = String(formData.get("summary") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const geographyScope = String(formData.get("geography_scope") ?? "citywide");
  const geographyLabel = String(formData.get("geography_label") ?? "").trim();
  const tagIds = formData.getAll("tag_ids").map((v) => Number(v));

  if (!title || !summary || !body) {
    throw new Error("Title, summary, and body text are all required.");
  }

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      owner_id: user.id,
      title,
      type,
      category_id: categoryId,
      summary,
      body,
      geography_scope: geographyScope,
      geography_label: geographyLabel || null,
    })
    .select("id")
    .single();

  if (error || !proposal) {
    throw new Error(error?.message ?? "Could not create the proposal.");
  }

  // First version snapshot, so comments have something to attach to.
  await supabase.from("proposal_versions").insert({
    proposal_id: proposal.id,
    version_number: 1,
    body,
    change_note: "Initial version.",
  });

  if (tagIds.length > 0) {
    await supabase
      .from("proposal_tags")
      .insert(tagIds.map((tag_id) => ({ proposal_id: proposal.id, tag_id })));
  }

  redirect(`/proposals/${proposal.id}`);
}

export async function addComment(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const versionId = String(formData.get("version_id"));
  const parentCommentId = formData.get("parent_comment_id");
  const body = String(formData.get("body") ?? "").trim();
  const suggestedBody = String(formData.get("suggested_body") ?? "").trim();

  if (!body) throw new Error("Comment can't be empty.");

  await supabase.from("comments").insert({
    proposal_id: proposalId,
    version_id: versionId,
    parent_comment_id: parentCommentId ? String(parentCommentId) : null,
    author_id: user.id,
    body,
    is_suggested_edit: Boolean(suggestedBody),
    suggested_body: suggestedBody || null,
  });

  revalidatePath(`/proposals/${proposalId}`);
}

// Owner resolves a suggested edit. Resolving as accepted / accepted_with_contingency
// does NOT auto-rewrite the proposal — the owner still chooses when to advance
// the version, so the writing stays theirs.
export async function resolveComment(formData: FormData) {
  const { supabase, user } = await requireUser();

  const commentId = String(formData.get("comment_id"));
  const proposalId = String(formData.get("proposal_id"));
  const status = String(formData.get("status"));
  const statusNote = String(formData.get("status_note") ?? "").trim();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();

  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can resolve suggestions.");
  }

  await supabase
    .from("comments")
    .update({ status, status_note: statusNote || null })
    .eq("id", commentId);

  revalidatePath(`/proposals/${proposalId}`);
}

// Owner advances the canonical text to a new version, incorporating whatever
// accepted edits they've chosen to fold in by hand. Every open comment thread
// from the current version carries forward, and past commenters can mark it
// "still not addressed" on the new version rather than blocking the advance.
export async function advanceVersion(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const newBody = String(formData.get("body") ?? "").trim();
  const changeNote = String(formData.get("change_note") ?? "").trim();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id, current_version")
    .eq("id", proposalId)
    .single();

  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can advance the version.");
  }
  if (!newBody) throw new Error("The new version needs body text.");

  const nextVersion = (proposal.current_version ?? 1) + 1;

  await supabase.from("proposal_versions").insert({
    proposal_id: proposalId,
    version_number: nextVersion,
    body: newBody,
    change_note: changeNote || null,
  });

  await supabase
    .from("proposals")
    .update({ body: newBody, current_version: nextVersion, updated_at: new Date().toISOString() })
    .eq("id", proposalId);

  revalidatePath(`/proposals/${proposalId}`);
}

export async function flagUnresolved(formData: FormData) {
  const { supabase } = await requireUser();
  const commentId = String(formData.get("comment_id"));
  const proposalId = String(formData.get("proposal_id"));

  await supabase
    .from("comments")
    .update({ unresolved_flagged: true })
    .eq("id", commentId);

  revalidatePath(`/proposals/${proposalId}`);
}

export async function react(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = formData.get("proposal_id");
  const commentId = formData.get("comment_id");
  const value = Number(formData.get("value"));

  const target = proposalId
    ? { proposal_id: String(proposalId), comment_id: null }
    : { proposal_id: null, comment_id: String(commentId) };

  await supabase
    .from("reactions")
    .upsert(
      { user_id: user.id, value, ...target },
      { onConflict: "user_id,proposal_id,comment_id" }
    );

  if (proposalId) revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/");
}

// Crowdsourced escalation flags. These never trigger an automatic email to
// officials or counsel — they just surface a count so Samantha (or a future
// partner) can review flagged proposals ahead of a scheduled roundtable.
export async function flagProposal(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const flagType = String(formData.get("flag_type"));

  await supabase
    .from("proposal_flags")
    .upsert(
      { proposal_id: proposalId, user_id: user.id, flag_type: flagType },
      { onConflict: "proposal_id,user_id,flag_type" }
    );

  revalidatePath(`/proposals/${proposalId}`);
}

// Adds a decision-maker to this proposal's power tree. Looks up the shared
// registry by name first (case-insensitive) so re-typing "Streets Department"
// reuses the same row instead of creating a duplicate; creates a new
// registry entry only if nothing matched, which is the "add new" path.
export async function addPowerTreeNode(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const name = String(formData.get("decision_maker_name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "other");
  const parentNodeId = formData.get("parent_node_id");
  const note = String(formData.get("note") ?? "").trim();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can edit its power tree.");
  }
  if (!name) throw new Error("Pick or name a decision-maker.");

  let { data: decisionMaker } = await supabase
    .from("decision_makers")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (!decisionMaker) {
    const { data: created, error } = await supabase
      .from("decision_makers")
      .insert({ name, kind, added_by: user.id })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not add that decision-maker.");
    decisionMaker = created;
  }

  await supabase.from("proposal_power_tree_nodes").insert({
    proposal_id: proposalId,
    decision_maker_id: decisionMaker.id,
    parent_node_id: parentNodeId ? String(parentNodeId) : null,
    note: note || null,
  });

  revalidatePath(`/proposals/${proposalId}`);
}
