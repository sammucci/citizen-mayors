"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Used at the top of every mutating action (vote, comment, add tags,
// etc.). Signed-out visitors can browse everything, but any action that
// needs an account used to throw a plain Error here — which Next.js
// redacts in production into a generic "Application error: a
// server-side exception has occurred" crash screen, since it can't tell
// a real crash apart from an ordinary validation message. redirect()
// isn't caught the same way — it's a real navigation, so a signed-out
// visitor clicking, say, a vote button now lands on the sign-in page
// instead of seeing a crash. redirect()'s return type is `never`, so
// TypeScript still narrows `user` to non-null below exactly like the
// old throw did.
async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Council district resolution shared by createProposal and
// updateProposalDetails. Citywide always means "every district," so it's
// left null and handled as a wildcard in filtering, never stored as a fixed
// value. For the council_district scope, the person picked it directly.
// For zip, we auto-populate it from the zip -> district crosswalk when that
// zip maps to exactly one district. Address/neighborhood don't have a
// reliable auto-lookup yet (needs real geocoding — see README), so they
// stay unset for now rather than guessing.
async function resolveCouncilDistrict(
  supabase: ReturnType<typeof createClient>,
  formData: FormData,
  geographyScope: string,
  geographyLabel: string
): Promise<number | null> {
  if (geographyScope === "council_district") {
    const picked = Number(formData.get("council_district"));
    return picked >= 1 && picked <= 10 ? picked : null;
  }
  if (geographyScope === "zip" && geographyLabel) {
    const { data: matches } = await supabase
      .from("zip_council_districts")
      .select("council_district")
      .eq("zip_code", geographyLabel);

    if (matches && matches.length === 1) {
      return matches[0].council_district;
    }
    // If it matches 0 or several districts, we leave it null rather than
    // guess wrong — the crosswalk table needs real data loaded before this
    // gets more precise (see README "Deferred to a fast-follow").
  }
  return null;
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

  const councilDistrict = await resolveCouncilDistrict(
    supabase,
    formData,
    geographyScope,
    geographyLabel
  );

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
      geography_label: geographyScope === "citywide" ? null : geographyLabel || null,
      council_district: councilDistrict,
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

  const imageFile = formData.get("image");
  if (isNonEmptyFile(imageFile)) {
    await uploadProposalImage(supabase, proposal.id, imageFile);
  }

  redirect(`/proposals/${proposal.id}`);
}

// Duck-typed file check instead of `instanceof File`. In some server
// runtimes the File object handed back by formData.get() isn't the same
// File class reference the server-side code imports/expects, which makes
// `instanceof File` unreliable — checking for the shape (has size,
// arrayBuffer()) works regardless.
function isNonEmptyFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).arrayBuffer === "function" &&
    typeof (value as any).size === "number" &&
    (value as any).size > 0
  );
}

// Shared by createProposal and updateProposalImage. Always saves to the
// same path per proposal (with upsert) so re-uploading just replaces the
// old cover image instead of piling up orphaned files. Never throws —
// an image problem shouldn't take down the whole proposal action. If the
// "proposal-images" bucket hasn't been created yet (migration not run),
// this fails quietly instead of crashing; the console.error at least
// leaves a clear trail in Vercel's function logs.
async function uploadProposalImage(
  supabase: ReturnType<typeof createClient>,
  proposalId: string,
  file: File
) {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${proposalId}/cover.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("proposal-images")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) {
      console.error("uploadProposalImage: storage upload failed", uploadError);
      return;
    }

    const { data: pub } = supabase.storage.from("proposal-images").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("proposals")
      .update({ image_url: pub.publicUrl })
      .eq("id", proposalId);
    if (updateError) {
      console.error("uploadProposalImage: saving image_url failed", updateError);
    }
  } catch (err) {
    console.error("uploadProposalImage: unexpected error", err);
  }
}

// Lets the owner add or replace a proposal's cover image after it's
// already been posted — the create form only asks once.
export async function updateProposalImage(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const imageFile = formData.get("image");

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can change the image.");
  }
  if (!isNonEmptyFile(imageFile)) {
    throw new Error("Choose an image file first.");
  }

  await uploadProposalImage(supabase, proposalId, imageFile);

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/");
}

// Lets the owner edit the proposal's basic details (title, type, category,
// geography) after it's already been posted — previously the only way to
// change any of this, including the category, was to delete and repost.
// Deliberately does NOT touch the proposal's body text or tags — the body
// has its own versioned "Advance to a new version" flow, and tags have
// their own add/remove UI, both to keep this one form simple.
export async function updateProposalDetails(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "policy");
  const categoryId = Number(formData.get("category_id"));
  const geographyScope = String(formData.get("geography_scope") ?? "citywide");
  const geographyLabel = String(formData.get("geography_label") ?? "").trim();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can edit its details.");
  }
  if (!title) throw new Error("Title can't be empty.");

  const councilDistrict = await resolveCouncilDistrict(
    supabase,
    formData,
    geographyScope,
    geographyLabel
  );

  const { error } = await supabase
    .from("proposals")
    .update({
      title,
      type,
      category_id: categoryId,
      geography_scope: geographyScope,
      geography_label: geographyScope === "citywide" ? null : geographyLabel || null,
      council_district: councilDistrict,
    })
    .eq("id", proposalId);

  if (error) throw new Error(error.message);

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/");
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

// Lets someone edit their own comment — but only while it's still the
// single most recent comment on the proposal. As soon as anything else
// gets posted after it (by anyone), it locks, so edits can't retroactively
// change context other people have already responded to.
export async function editComment(formData: FormData) {
  const { supabase, user } = await requireUser();

  const commentId = String(formData.get("comment_id"));
  const proposalId = String(formData.get("proposal_id"));
  const body = String(formData.get("body") ?? "").trim();
  const suggestedBody = String(formData.get("suggested_body") ?? "").trim();

  if (!body) throw new Error("Comment can't be empty.");

  const { data: comment } = await supabase
    .from("comments")
    .select("author_id")
    .eq("id", commentId)
    .single();
  if (comment?.author_id !== user.id) {
    throw new Error("You can only edit your own comment.");
  }

  const { data: latest } = await supabase
    .from("comments")
    .select("id")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (latest?.id !== commentId) {
    throw new Error("This comment can no longer be edited — others have commented since.");
  }

  await supabase
    .from("comments")
    .update({
      body,
      is_suggested_edit: Boolean(suggestedBody),
      suggested_body: suggestedBody || null,
    })
    .eq("id", commentId);

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

// Votes toggle: clicking the same reaction again removes it, clicking the
// other one switches it. Looks up any existing reaction first rather than
// relying purely on a database upsert, so this can't double-count votes
// regardless of how the underlying constraint is set up.
//
// proposal_id is now always sent (even when voting on a comment) purely
// so this knows which proposal page to revalidate — whether the vote
// itself lands on the proposal or a comment is decided by whether
// comment_id is present, not by proposal_id. Comment votes used to omit
// proposal_id entirely, which meant a comment vote never refreshed the
// proposal page it actually happened on — only the homepage.
export async function react(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const commentId = formData.get("comment_id");
  const value = Number(formData.get("value"));
  const isCommentVote = Boolean(commentId);

  let existingQuery = supabase
    .from("reactions")
    .select("id, value")
    .eq("user_id", user.id);

  existingQuery = isCommentVote
    ? existingQuery.eq("comment_id", String(commentId)).is("proposal_id", null)
    : existingQuery.eq("proposal_id", proposalId).is("comment_id", null);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    if (existing.value === value) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("reactions").update({ value }).eq("id", existing.id);
    }
  } else {
    await supabase.from("reactions").insert({
      user_id: user.id,
      proposal_id: isCommentVote ? null : proposalId,
      comment_id: isCommentVote ? String(commentId) : null,
      value,
    });
  }

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

// Lets the owner tag a proposal further after it's already been posted —
// the original post form only asked once, with no way back in.
export async function addProposalTags(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const tagIds = formData.getAll("tag_ids").map((v) => Number(v));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can add tags.");
  }
  if (tagIds.length === 0) return;

  await supabase
    .from("proposal_tags")
    .upsert(
      tagIds.map((tag_id) => ({ proposal_id: proposalId, tag_id })),
      { onConflict: "proposal_id,tag_id", ignoreDuplicates: true }
    );

  revalidatePath(`/proposals/${proposalId}`);
}

// Anyone signed in can suggest a brand-new tag that doesn't exist yet —
// unlike addProposalTags (owner-only, picks from the existing list),
// this is open to any user and doesn't touch the real tags table.
// It just logs a pending request; an admin reviews it at
// /admin/tag-suggestions and either creates the real tag (which also
// attaches it to this proposal) or rejects it.
export async function suggestTag(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  await supabase.from("tag_suggestions").insert({
    proposal_id: proposalId,
    suggested_by: user.id,
    label,
  });

  revalidatePath(`/proposals/${proposalId}`);
}

// Removes a single tag from this proposal (owner only). The tag itself
// stays in the shared tags table — this only removes the link.
export async function removeProposalTag(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const tagId = Number(formData.get("tag_id"));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can remove tags.");
  }

  await supabase
    .from("proposal_tags")
    .delete()
    .eq("proposal_id", proposalId)
    .eq("tag_id", tagId);

  revalidatePath(`/proposals/${proposalId}`);
}

// Edits a power-tree node's role/note in place — previously the only
// way to fix a wrong or missing role was to delete the whole entry and
// re-add it (losing its position in the list). Reuses the same "owner
// reorders own power tree" update policy from the arrow-reorder fix, so
// no new migration is needed.
export async function updatePowerTreeNodeNote(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const nodeId = String(formData.get("node_id"));
  const note = String(formData.get("note") ?? "").trim();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can edit its power tree.");
  }

  await supabase
    .from("proposal_power_tree_nodes")
    .update({ note: note || null })
    .eq("id", nodeId);

  revalidatePath(`/proposals/${proposalId}`);
}

// Best-effort proper-case for a typed name ("quetcy lozada" -> "Quetcy
// Lozada", "o'neill" -> "O'Neill"). Won't get every edge case (suffixes
// like "Jr." stay capitalized as typed-then-lowered), but handles the
// common case of someone typing a name in all lowercase.
function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|\s|-|')([a-z])/g, (_match, sep, letter) => sep + letter.toUpperCase());
}

// Adds a decision-maker to this proposal's power tree. Looks up the shared
// registry by name first (case-insensitive) so re-typing "Streets Department"
// reuses the same row instead of creating a duplicate; creates a new
// registry entry only if nothing matched, which is the "add new" path.
export async function addPowerTreeNode(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const rawName = String(formData.get("decision_maker_name") ?? "").trim();
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
  if (!rawName) throw new Error("Pick or name a decision-maker.");

  let { data: decisionMaker } = await supabase
    .from("decision_makers")
    .select("id")
    .ilike("name", rawName)
    .maybeSingle();

  if (!decisionMaker) {
    const { data: created, error } = await supabase
      .from("decision_makers")
      .insert({ name: toTitleCase(rawName), kind, added_by: user.id })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not add that decision-maker.");
    decisionMaker = created;
  }

  const { data: existingNodes } = await supabase
    .from("proposal_power_tree_nodes")
    .select("sort_order")
    .eq("proposal_id", proposalId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder = (existingNodes?.[0]?.sort_order ?? -1) + 1;

  await supabase.from("proposal_power_tree_nodes").insert({
    proposal_id: proposalId,
    decision_maker_id: decisionMaker.id,
    parent_node_id: parentNodeId ? String(parentNodeId) : null,
    note: note || null,
    sort_order: nextSortOrder,
  });

  revalidatePath(`/proposals/${proposalId}`);
}

// Moves a decision-maker up or down in the power tree by swapping
// sort_order with its neighbor. Simple up/down buttons instead of
// drag-and-drop — easier to build correctly and more reliable on phones.
export async function movePowerTreeNode(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const nodeId = String(formData.get("node_id"));
  const direction = String(formData.get("direction")); // "up" | "down"

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can reorder its power tree.");
  }

  const { data: nodes } = await supabase
    .from("proposal_power_tree_nodes")
    .select("id, sort_order")
    .eq("proposal_id", proposalId)
    .order("sort_order", { ascending: true });

  if (!nodes) return;
  const index = nodes.findIndex((n) => n.id === nodeId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= nodes.length) return;

  const current = nodes[index];
  const swapWith = nodes[swapIndex];

  await supabase
    .from("proposal_power_tree_nodes")
    .update({ sort_order: swapWith.sort_order })
    .eq("id", current.id);
  await supabase
    .from("proposal_power_tree_nodes")
    .update({ sort_order: current.sort_order })
    .eq("id", swapWith.id);

  revalidatePath(`/proposals/${proposalId}`);
}

// Removes a decision-maker from THIS proposal's tree only — the shared
// registry entry itself stays, since other proposals may reference it.
export async function removePowerTreeNode(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const nodeId = String(formData.get("node_id"));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can edit its power tree.");
  }

  await supabase.from("proposal_power_tree_nodes").delete().eq("id", nodeId);

  revalidatePath(`/proposals/${proposalId}`);
}
