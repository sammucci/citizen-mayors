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

  // Blocked members can still sign in and read everything (their past
  // posts stay up, matching the non-destructive approach used
  // elsewhere) — this just stops any NEW write: proposals, comments,
  // votes, tags, decision-chain contributions, all of which funnel
  // through this same requireUser().
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_blocked")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_blocked) {
    throw new Error("Your account has been blocked from posting. Contact the site admin if you think this is a mistake.");
  }

  return { supabase, user };
}

// Council district resolution shared by createProposal and
// updateProposalDetails. Citywide always means "every district," so it's
// left null and handled as a wildcard in filtering, never stored as a fixed
// value. For the council_district scope, the person picked it directly.
// For zip, we auto-populate it from the zip -> district crosswalk, which
// now holds a real GIS spatial join (zip and district boundaries actually
// intersected, not a guess) with a real overlap_pct per row. When a zip
// spans more than one district, this picks the one with the highest
// overlap — nearly every split zip in Philadelphia is >50% in one
// district, so "most of this zip" is a reasonable auto-fill rather than
// leaving it blank; the person can always correct it by hand.
// Address/neighborhood don't have a reliable auto-lookup yet (needs real
// geocoding — see README), so they stay unset for now.
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
      .select("council_district, overlap_pct")
      .eq("zip_code", geographyLabel)
      .order("overlap_pct", { ascending: false });

    if (matches && matches.length > 0) {
      return matches[0].council_district;
    }
    // Zip not in the crosswalk at all — leave it null rather than guess.
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
  // Two submit buttons on the form share the "published" field name with
  // different values — only the one actually clicked ends up in
  // formData, so this reads as "publish now" unless "Save as draft" was
  // the one pressed.
  const published = formData.get("published") !== "false";

  // A draft only needs a title — that's the one thing you can't come back
  // and fill in later without first having something to find on your
  // profile. Summary and body stay required, but only on the "Post
  // proposal" path; the DB columns themselves are NOT NULL (not
  // nullable), so an unfinished draft stores them as empty strings rather
  // than needing a schema change.
  if (!title) {
    throw new Error("A proposal needs at least a title.");
  }
  if (published && (!summary || !body)) {
    throw new Error("Title, summary, and body text are all required to publish.");
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
      summary: summary || "",
      body: body || "",
      geography_scope: geographyScope,
      geography_label: geographyScope === "citywide" ? null : geographyLabel || null,
      council_district: councilDistrict,
      published,
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
// old cover image instead of piling up orphaned files. Returns an error
// string instead of throwing (an image problem shouldn't take down the
// whole proposal action) — but unlike before, that error string used to
// just get logged server-side and silently dropped, so a too-large file
// looked exactly like a dead button with nothing on screen explaining
// why. Callers that can show it (updateProposalImage) now do.
async function uploadProposalImage(
  supabase: ReturnType<typeof createClient>,
  proposalId: string,
  file: File
): Promise<{ error?: string }> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${proposalId}/cover.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("proposal-images")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) {
      console.error("uploadProposalImage: storage upload failed", uploadError);
      const msg = uploadError.message ?? "";
      if (/size|large|payload|413/i.test(msg)) {
        return { error: "Your image is too big — try a smaller file (under 20MB)." };
      }
      return { error: "That image couldn't be uploaded. Try a different file." };
    }

    const { data: pub } = supabase.storage.from("proposal-images").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("proposals")
      .update({ image_url: pub.publicUrl })
      .eq("id", proposalId);
    if (updateError) {
      console.error("uploadProposalImage: saving image_url failed", updateError);
      return { error: "Image uploaded, but saving it to the proposal failed. Try again." };
    }
    return {};
  } catch (err) {
    console.error("uploadProposalImage: unexpected error", err);
    return { error: "Something went wrong uploading that image. Try again." };
  }
}

// Lets the owner add or replace a proposal's cover image after it's
// already been posted — the create form only asks once.
export async function updateProposalImage(
  formData: FormData
): Promise<{ error?: string }> {
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
    return { error: "Choose an image file first." };
  }

  const result = await uploadProposalImage(supabase, proposalId, imageFile);

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/");
  return result;
}

// Lets the owner set the cover image's focal point — the crop
// (object-cover) can cut off the part of the photo that actually
// matters, so this stores where "the important part" is as an x/y
// percentage pair and every render uses it as the CSS object-position.
// No revalidatePath("/") here on purpose: this fires on every drag-end
// while dragging, and the homepage doesn't need a live update mid-drag.
export async function updateProposalImagePosition(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const x = Math.min(100, Math.max(0, Math.round(Number(formData.get("x")))));
  const y = Math.min(100, Math.max(0, Math.round(Number(formData.get("y")))));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can reposition the image.");
  }

  await supabase
    .from("proposals")
    .update({ image_position_x: x, image_position_y: y })
    .eq("id", proposalId);

  revalidatePath(`/proposals/${proposalId}`);
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

// Permanently removes a proposal — previously the only option was
// editing; there was no way back out short of asking Samantha to do it
// by hand in the database. Every child table (comments, tags, versions,
// the whole decision-power-tree, reactions, flags, tag suggestions) is
// declared "on delete cascade" back to proposals in the schema, so this
// one delete cleans up all of it — no separate cleanup queries needed.
export async function deleteProposal(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can delete it.");
  }

  const { error } = await supabase.from("proposals").delete().eq("id", proposalId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect("/");
}

// Reversible alternative to deleting — takes a proposal down from
// public view (or brings it back) without touching its comments,
// decision chain, versions, or votes. The RLS select policy on
// proposals is what actually enforces the hiding (see schema); this
// just flips the flag it reads. Also doubles as a way to publish a
// proposal that was originally saved as a draft.
export async function toggleProposalPublished(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const nextPublished = formData.get("published") === "true";

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can publish or unpublish it.");
  }

  await supabase.from("proposals").update({ published: nextPublished }).eq("id", proposalId);

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/");
}

// Owner-only flag: does this proposal actually need funding to happen?
// Off by default — a lot of policy proposals cost nothing to pass. When
// on, the "Funding leads" subsection under "Getting it done" shows up;
// when off, it's hidden entirely rather than showing an empty section
// on every proposal regardless of whether funding is even relevant.
export async function toggleFundingNeeded(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const nextValue = formData.get("funding_needed") === "true";

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can change this.");
  }

  await supabase.from("proposals").update({ funding_needed: nextValue }).eq("id", proposalId);

  revalidatePath(`/proposals/${proposalId}`);
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

// Anyone signed in can suggest a tag on a proposal they don't own —
// either an existing one (typed to match, or picked from the datalist
// the form offers) or a brand-new one. Which review path it takes
// depends entirely on whether the label matches a real tag, resolved
// here server-side so it works the same whether the visitor picked from
// the datalist or just happened to type the exact existing name:
//   existing tag  -> tag_id set   -> only the proposal owner needs to
//                                    approve it (see approveTagSuggestion)
//   brand-new tag -> tag_id null  -> owner approves first, then an
//                                    admin finalizes it
// Doesn't touch the real tags/proposal_tags tables itself either way —
// this only ever logs the pending request.
export async function suggestTag(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  const { data: existingTag } = await supabase
    .from("tags")
    .select("id")
    .ilike("label", label)
    .maybeSingle();

  await supabase.from("tag_suggestions").insert({
    proposal_id: proposalId,
    suggested_by: user.id,
    label,
    tag_id: existingTag?.id ?? null,
  });

  revalidatePath(`/proposals/${proposalId}`);
}

// Slugify used both here (creating a brand-new tag on final admin
// approval) and in admin/actions.ts's renameTag/addTagAdmin — kept as
// its own small copy in each file rather than a shared import, matching
// how the other small per-file helpers are already handled in this
// codebase.
function slugifyTagLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

async function isAdminOrProposalOwner(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  proposalId: string
): Promise<{ isOwner: boolean; isAdmin: boolean }> {
  const [{ data: proposal }, { data: profile }] = await Promise.all([
    supabase.from("proposals").select("owner_id").eq("id", proposalId).single(),
    supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
  ]);
  return {
    isOwner: proposal?.owner_id === userId,
    isAdmin: Boolean(profile?.is_admin),
  };
}

// Advances a pending tag suggestion — what "approve" actually does
// depends on who's calling it and what stage the suggestion is at (see
// the tag_suggestions table comment in schema.sql for the full state
// machine). The RLS policies enforce the same rules at the database
// level too, so this app-layer check is what gives a clear error
// message rather than a silent RLS-denied failure.
export async function approveTagSuggestion(formData: FormData) {
  const { supabase, user } = await requireUser();

  const suggestionId = String(formData.get("suggestion_id"));
  const proposalId = String(formData.get("proposal_id"));
  const label = String(formData.get("label"));
  const tagIdRaw = formData.get("tag_id");
  const tagId = tagIdRaw ? Number(tagIdRaw) : null;

  const { isOwner, isAdmin } = await isAdminOrProposalOwner(supabase, user.id, proposalId);
  if (!isOwner && !isAdmin) {
    throw new Error("Only the proposal owner or an admin can approve tag suggestions.");
  }

  if (tagId) {
    // Existing tag — owner or admin can finalize it directly, since
    // nothing new is being created, just attached.
    await supabase
      .from("proposal_tags")
      .upsert({ proposal_id: proposalId, tag_id: tagId }, { onConflict: "proposal_id,tag_id", ignoreDuplicates: true });
    await supabase.from("tag_suggestions").update({ status: "approved" }).eq("id", suggestionId);
  } else if (isAdmin) {
    // Brand-new tag, and an admin is finalizing it. This is the one
    // step that actually creates a shared tags row and attaches it to
    // someone's proposal, so it's only ever allowed once the OWNER has
    // already moved this suggestion to owner_approved — an admin can't
    // skip that and populate a proposal's tags on their own, no matter
    // how this action gets called.
    const { data: current } = await supabase
      .from("tag_suggestions")
      .select("status")
      .eq("id", suggestionId)
      .single();
    if (current?.status !== "owner_approved") {
      throw new Error("The proposal owner needs to approve this tag before it can be finalized.");
    }
    const { data: existingTag } = await supabase.from("tags").select("id").ilike("label", label).maybeSingle();
    let newTagId = existingTag?.id;
    if (!newTagId) {
      const { data: created, error } = await supabase
        .from("tags")
        .insert({ slug: slugifyTagLabel(label), label })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "Could not create that tag.");
      newTagId = created.id;
    }
    await supabase
      .from("proposal_tags")
      .upsert({ proposal_id: proposalId, tag_id: newTagId }, { onConflict: "proposal_id,tag_id", ignoreDuplicates: true });
    await supabase.from("tag_suggestions").update({ status: "approved", tag_id: newTagId }).eq("id", suggestionId);
  } else {
    // Owner approving a brand-new tag only ever advances it one step —
    // it doesn't attach anything yet, just signals "yes, I want this on
    // my proposal if an admin also signs off."
    await supabase.from("tag_suggestions").update({ status: "owner_approved" }).eq("id", suggestionId);
  }

  revalidatePath("/admin/tags");
  revalidatePath(`/proposals/${proposalId}`);
}

export async function rejectTagSuggestion(formData: FormData) {
  const { supabase, user } = await requireUser();

  const suggestionId = String(formData.get("suggestion_id"));
  const proposalId = String(formData.get("proposal_id"));

  const { isOwner, isAdmin } = await isAdminOrProposalOwner(supabase, user.id, proposalId);
  if (!isOwner && !isAdmin) {
    throw new Error("Only the proposal owner or an admin can reject tag suggestions.");
  }

  await supabase.from("tag_suggestions").update({ status: "rejected" }).eq("id", suggestionId);

  revalidatePath("/admin/tags");
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

// Owner-only: sets or clears the optional note on the fixed "We the
// people" anchor at the bottom of the decision chain — what the actual
// first step looks like (e.g. "Write proposal", "Make petition"). That
// anchor isn't a real power-tree node (see PowerTreeChain), so this
// updates the proposal row directly rather than going through the
// power-tree-node actions below.
export async function updatePeopleActionNote(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const note = String(formData.get("people_action_note") ?? "").trim();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can edit this.");
  }

  await supabase
    .from("proposals")
    .update({ people_action_note: note || null })
    .eq("id", proposalId);

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

// Reassigns sort_order = array position for a whole ordered list of node
// ids in one go. Backing both "insert at a specific spot" and drag
// reorder with the same full-reindex approach means neither has to deal
// with the edge cases of fractional ordering or shifting a partial
// range — just rewrite the whole list's positions every time. Fine for
// how many decision-makers a proposal's chain realistically has.
// Errors here used to be silently dropped — a real RLS policy gap once
// made every one of these updates fail for a non-owner's suggestion
// (the insert succeeded, so nothing looked broken at a glance, but the
// new node never actually moved to its intended spot). Logging any
// failure now so a future permissions gap like that shows up in the
// server logs instead of just looking like a mysterious position bug.
async function reindexPowerTreeNodes(
  supabase: ReturnType<typeof createClient>,
  orderedIds: string[]
) {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("proposal_power_tree_nodes").update({ sort_order: index }).eq("id", id)
    )
  );
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    console.error(
      "reindexPowerTreeNodes: one or more sort_order updates failed",
      failed.map((r) => r.error?.message)
    );
  }
}

// Adds a decision-maker to this proposal's power tree, at a specific
// position rather than always appended at the end — insertIndex is a
// 0-based position in ascending sort_order terms (lowest = closest to
// "We the people", highest = the final decision-maker). Omitting it
// appends at the end, same as the old behavior.
//
// Looks up the shared registry by name first (case-insensitive) so
// re-typing "Streets Department" reuses the same row instead of
// creating a duplicate; creates a new registry entry only if nothing
// matched, which is the "add new" path.
// Open to the whole community now, not just the proposal owner — the
// decision chain is meant to be a shared, crowdsourced record, and
// requiring the owner to add every entry themselves was the one part
// of it that wasn't. The owner's own additions still land approved
// immediately (unchanged); anyone else's land 'pending' until the
// owner approves or removes them, so the chain stays owner-curated
// even though the suggestions can come from anywhere.
export async function addPowerTreeNode(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const rawName = String(formData.get("decision_maker_name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "other");
  const note = String(formData.get("note") ?? "").trim();
  const insertIndexRaw = formData.get("insert_index");

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) throw new Error("Proposal not found.");
  const isOwner = proposal.owner_id === user.id;
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
    .select("id, sort_order")
    .eq("proposal_id", proposalId)
    .order("sort_order", { ascending: true });
  const existingIds = (existingNodes ?? []).map((n) => n.id);

  const { data: newNode, error: insertError } = await supabase
    .from("proposal_power_tree_nodes")
    .insert({
      proposal_id: proposalId,
      decision_maker_id: decisionMaker.id,
      note: note || null,
      sort_order: existingIds.length, // placeholder — reindexed below
      status: isOwner ? "approved" : "pending",
      submitted_by: user.id,
    })
    .select("id")
    .single();
  if (insertError || !newNode) {
    throw new Error(insertError?.message ?? "Could not add that decision-maker.");
  }

  const insertIndex =
    insertIndexRaw != null && insertIndexRaw !== ""
      ? Math.max(0, Math.min(existingIds.length, Number(insertIndexRaw)))
      : existingIds.length;
  existingIds.splice(insertIndex, 0, newNode.id);
  await reindexPowerTreeNodes(supabase, existingIds);

  revalidatePath(`/proposals/${proposalId}`);
}

// Attaches a grant lead to a proposal — creates the shared registry
// entry if it doesn't already exist (case-insensitive match against
// `name`, same create-or-reuse pattern as addPowerTreeNode above), or
// reuses the existing one if it does. Open to anyone signed in, no
// approval step: unlike a decision-maker suggestion, this never lands
// "pending" — a funding lead is information, not a claim being made on
// the proposal's behalf, so there's nothing for the owner to approve.
export async function addProposalGrant(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const rawName = String(formData.get("grant_name") ?? "").trim();
  const funder = String(formData.get("funder") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!rawName) return { error: "Give the grant or funding program a name." };

  let { data: grant } = await supabase
    .from("grants")
    .select("id")
    .ilike("name", rawName)
    .maybeSingle();

  if (!grant) {
    const { data: created, error } = await supabase
      .from("grants")
      .insert({
        name: rawName,
        funder: funder || null,
        url: url || null,
        description: description || null,
        added_by: user.id,
      })
      .select("id")
      .single();
    if (error || !created) return { error: error?.message ?? "Could not add that grant." };
    grant = created;
  }

  const { error: linkError } = await supabase
    .from("proposal_grants")
    .insert({
      proposal_id: proposalId,
      grant_id: grant.id,
      note: note || null,
      submitted_by: user.id,
    });
  if (linkError) {
    return {
      error: /duplicate|unique/i.test(linkError.message)
        ? "That grant is already attached to this proposal."
        : "Could not attach that grant. Try again.",
    };
  }

  revalidatePath(`/proposals/${proposalId}`);
  return {};
}

// Owner or admin only (enforced by RLS on proposal_grants' delete
// policy) — removing a lead never touches the shared grants registry
// entry itself, just this proposal's link to it.
export async function removeProposalGrant(formData: FormData) {
  const { supabase } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const proposalGrantId = String(formData.get("proposal_grant_id"));

  await supabase.from("proposal_grants").delete().eq("id", proposalGrantId);

  revalidatePath(`/proposals/${proposalId}`);
}

// Owner-only: flips a community-suggested node from pending to
// approved, giving it the same standing as anything the owner added
// directly. Rejecting a suggestion is just removePowerTreeNode — no
// separate "reject" action needed.
export async function approvePowerTreeNode(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const nodeId = String(formData.get("node_id"));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can approve suggestions.");
  }

  await supabase
    .from("proposal_power_tree_nodes")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", nodeId);

  revalidatePath(`/proposals/${proposalId}`);
}

// Full drag-and-drop reorder — the client sends the whole chain's node
// ids in the new order it wants (ascending sort_order terms; the
// component reversed-for-display list converts back before sending),
// and this just reindexes to match. Replaces the old up/down arrow
// swap, which read as messy clutter next to everything else here.
export async function reorderPowerTreeNodes(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const orderedIds = formData.getAll("node_id").map(String);

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can reorder its power tree.");
  }
  if (orderedIds.length === 0) return;

  await reindexPowerTreeNodes(supabase, orderedIds);

  revalidatePath(`/proposals/${proposalId}`);
}

// Adds one dated entry to a decision-maker's running update log for
// this proposal — when someone talked to them, what came of it,
// anything learned about working with them. Open to any signed-in
// person, not just the proposal owner: this kind of on-the-ground
// knowledge is useful from whoever has it.
//
// Doubles as the reply action: an optional parent_update_id makes this
// a reply to another note instead of a new top-level one (e.g.
// answering a question someone asked in their note) — deliberately
// single-level, so a reply itself can't be replied to. The talked_to
// checkbox is the actual point of the whole log: it's what lets the
// site show whether people are following through and really
// contacting decision-makers, not just talking about them.
export async function addPowerTreeNodeUpdate(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const nodeId = String(formData.get("node_id"));
  const body = String(formData.get("body") ?? "").trim();
  const parentUpdateId = formData.get("parent_update_id");
  const talkedTo = formData.get("talked_to") === "on";
  if (!body) return;

  await supabase.from("power_tree_node_updates").insert({
    node_id: nodeId,
    author_id: user.id,
    body,
    parent_update_id: parentUpdateId ? String(parentUpdateId) : null,
    talked_to: talkedTo,
  });

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
