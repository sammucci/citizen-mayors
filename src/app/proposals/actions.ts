"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress, titleCaseAddress } from "@/lib/geocode-address";
import { canonicalizeNeighborhoodName, geocodeNeighborhood } from "@/lib/geocode-neighborhood";
import { MAX_TAGS_PER_PROPOSAL } from "@/lib/proposal-limits";

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
// Address now HAS real coordinates (see geocodeAddress below), but
// turning a point into "which council district is this inside" needs a
// point-in-polygon check against the district boundaries, which is a
// separate piece of work from just getting a pin on the map — left unset
// for address/neighborhood for now, same as before.
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
  // Canonicalized against the curated neighborhood list up front (see
  // geocode-neighborhood.ts) — "point breeze" and "Point Breeze" need to
  // end up as the exact same stored string, or every count/filter that
  // groups by geography_label silently splits into two. A no-op for
  // every other scope, and for a neighborhood name that isn't in the
  // list at all (still stored as typed, just not normalized or geocoded).
  const geographyLabel =
    geographyScope === "neighborhood"
      ? canonicalizeNeighborhoodName(String(formData.get("geography_label") ?? ""))
      : String(formData.get("geography_label") ?? "").trim();
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

  // Real coordinates for a specific address/intersection, via the Census
  // geocoder — this is what actually lets an address-scoped proposal show
  // up on the map at all (before this, only council_district-scope
  // proposals could plot anywhere, since a centroid was the only location
  // data that existed). Failing quietly (geocodeAddress never throws) so
  // a geocoding hiccup never blocks posting a proposal.
  const geocoded =
    geographyScope === "address" && geographyLabel
      ? await geocodeAddress(geographyLabel)
      : geographyScope === "neighborhood" && geographyLabel
      ? geocodeNeighborhood(geographyLabel)
      : null;

  // For an address, show what the geocoder actually resolved to instead
  // of the raw typed text — fixes both stray capitalization ("n mascher
  // and w colona") and an in-range typo that still matched (the geocoder
  // matches against real street data, so its version is the correctly
  // spelled one). No match at all just falls back to a title-cased
  // version of what was typed — still an improvement, just nothing to
  // correct a typo against.
  const displayGeographyLabel =
    geographyScope === "address" && geographyLabel
      ? geocoded?.label ?? titleCaseAddress(geographyLabel)
      : geographyLabel;

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
      geography_label: geographyScope === "citywide" ? null : displayGeographyLabel || null,
      council_district: councilDistrict,
      geocoded_lat: geocoded?.lat ?? null,
      geocoded_lng: geocoded?.lng ?? null,
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

// Lets the owner clear a cover image entirely instead of only ever being
// able to replace it with another one — previously the only path back
// from "I don't want this image anymore" was uploading a different file.
// Best-effort delete of the actual file from storage too, so removing an
// image doesn't just hide it while leaving it sitting in the bucket
// forever; not fatal if that part fails (a URL that doesn't parse the
// way expected, a storage hiccup) since clearing image_url is the part
// that actually controls what renders.
export async function removeProposalImage(
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id, image_url")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can remove the image.");
  }

  if (proposal.image_url) {
    const marker = "/proposal-images/";
    const idx = proposal.image_url.indexOf(marker);
    if (idx !== -1) {
      const path = proposal.image_url.slice(idx + marker.length);
      const { error: storageError } = await supabase.storage
        .from("proposal-images")
        .remove([path]);
      if (storageError) {
        console.error("removeProposalImage: storage delete failed", storageError);
      }
    }
  }

  const { error } = await supabase
    .from("proposals")
    .update({ image_url: null, image_position_x: null, image_position_y: null })
    .eq("id", proposalId);
  if (error) {
    console.error("removeProposalImage: clearing image_url failed", error);
    return { error: "Couldn't remove the image. Try again." };
  }

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/");
  return {};
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
  const geographyLabel =
    geographyScope === "neighborhood"
      ? canonicalizeNeighborhoodName(String(formData.get("geography_label") ?? ""))
      : String(formData.get("geography_label") ?? "").trim();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id, geography_scope, geography_label, geocoded_lat, geocoded_lng")
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

  // Only hit the geocoder again if the address actually changed (or the
  // scope just switched TO address, or a previous attempt never found a
  // match) — re-saving a proposal with the same address every time
  // someone edits an unrelated field shouldn't re-fire an external API
  // call for no reason. Neighborhood centroids are a plain local lookup
  // (no external call), so there's no cost to just recomputing those
  // every time — no need for the same unchanged-shortcut.
  let geocoded: { lat: number; lng: number; label?: string | null } | null = null;
  // Whether re-geocoding actually ran this time — if it didn't (address
  // unchanged, reusing the saved coordinates), the stored label shouldn't
  // change either, since there's no fresh matchedAddress to prefer over
  // whatever's already saved (which, if this proposal was ever saved
  // since this fix shipped, is already the corrected version anyway).
  let addressUnchanged = false;
  if (geographyScope === "address" && geographyLabel) {
    addressUnchanged =
      proposal?.geography_scope === "address" && proposal.geography_label === geographyLabel;
    geocoded =
      addressUnchanged && proposal?.geocoded_lat != null && proposal?.geocoded_lng != null
        ? { lat: proposal.geocoded_lat, lng: proposal.geocoded_lng }
        : await geocodeAddress(geographyLabel);
  } else if (geographyScope === "neighborhood" && geographyLabel) {
    geocoded = geocodeNeighborhood(geographyLabel);
  }

  // Same fix as createProposal: prefer what the geocoder actually
  // resolved to over the raw typed text, so a stray lowercase intersection
  // or an in-range typo doesn't stay wrong forever just because it's
  // being edited rather than newly posted.
  const displayGeographyLabel =
    geographyScope === "address" && geographyLabel
      ? addressUnchanged
        ? geographyLabel
        : geocoded?.label ?? titleCaseAddress(geographyLabel)
      : geographyLabel;

  const { error } = await supabase
    .from("proposals")
    .update({
      title,
      type,
      category_id: categoryId,
      geography_scope: geographyScope,
      geography_label: geographyScope === "citywide" ? null : displayGeographyLabel || null,
      council_district: councilDistrict,
      geocoded_lat: geocoded?.lat ?? null,
      geocoded_lng: geocoded?.lng ?? null,
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
//
// Also usable by an admin on ANY proposal, not just their own — admins
// pile up test proposals while trying out functionality, and one-at-a-
// time deletion from each proposal's own page was the only path before
// this (see the "delete from the list/card" button on the profile page's
// proposal grid, and "admin deletes any proposal" in schema.sql, which
// backs this at the RLS layer too).
export async function deleteProposal(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));

  const [{ data: proposal }, { data: profile }] = await Promise.all([
    supabase.from("proposals").select("owner_id").eq("id", proposalId).single(),
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
  ]);
  if (proposal?.owner_id !== user.id && !profile?.is_admin) {
    throw new Error("Only the proposal owner or an admin can delete it.");
  }

  const { error } = await supabase.from("proposals").delete().eq("id", proposalId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/");
}

// Same delete, but for use from a list/card (profile page's proposal
// grid) instead of the proposal's own page — that context shouldn't
// redirect anywhere since you're not ON the proposal you just deleted,
// you're on a list of OTHER proposals that should just re-render minus
// this one.
export async function deleteProposalFromList(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));

  const [{ data: proposal }, { data: profile }] = await Promise.all([
    supabase.from("proposals").select("owner_id").eq("id", proposalId).single(),
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
  ]);
  if (proposal?.owner_id !== user.id && !profile?.is_admin) {
    throw new Error("Only the proposal owner or an admin can delete it.");
  }

  const { error } = await supabase.from("proposals").delete().eq("id", proposalId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/profile");
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

// Note: the old owner-only "funding needed" flag + flat grants list is
// gone — funding is now its own node type inside addPowerTreeNode above,
// sequenced directly in the chain (see toggleNodeCompleted below for the
// mark-as-done piece that applies to every node type).

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

async function countProposalTags(
  supabase: ReturnType<typeof createClient>,
  proposalId: string
): Promise<number> {
  const { count } = await supabase
    .from("proposal_tags")
    .select("*", { count: "exact", head: true })
    .eq("proposal_id", proposalId);
  return count ?? 0;
}

// Anyone signed in can suggest a tag — either an existing one (typed to
// match, or picked from the datalist the form offers) or a brand-new
// one. Which review path it takes depends on whether the label matches a
// real tag AND whether the proposal's own owner is the one suggesting it
// (same trust model as every other crowdsourced-suggestion action in
// this file — addPhase, addPowerTreeNode, etc. — real bug fix: this one
// had been requiring the owner to click Approve on their own tag, which
// nothing else in the app makes you do):
//   existing tag, owner suggesting it -> attached immediately, no
//                                         approval step at all
//   existing tag, someone else        -> tag_id set, pending until the
//                                         owner approves (see
//                                         approveTagSuggestion)
//   brand-new tag, owner suggesting   -> skips straight to
//                                         owner_approved (an admin still
//                                         has to finalize a genuinely
//                                         new tag either way, but the
//                                         owner doesn't need to approve
//                                         their own suggestion first)
//   brand-new tag, someone else       -> pending; owner approves first,
//                                         then an admin finalizes
export async function suggestTag(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return {};

  // Checked up front, before creating anything — a suggestion that can
  // never actually attach (because the proposal's already full) is more
  // confusing left pending than just told no right away, whether it's a
  // brand-new tag or one that already exists.
  const currentCount = await countProposalTags(supabase, proposalId);
  if (currentCount >= MAX_TAGS_PER_PROPOSAL) {
    return { error: `This proposal already has the max of ${MAX_TAGS_PER_PROPOSAL} tags — remove one before adding another.` };
  }

  const { data: existingTag } = await supabase
    .from("tags")
    .select("id")
    .ilike("label", label)
    .maybeSingle();

  const { isOwner } = await isAdminOrProposalOwner(supabase, user.id, proposalId);

  if (isOwner && existingTag) {
    // Nothing to approve — the owner suggesting a tag that already
    // exists is exactly the same thing as just adding it directly.
    await supabase
      .from("proposal_tags")
      .upsert({ proposal_id: proposalId, tag_id: existingTag.id }, { onConflict: "proposal_id,tag_id", ignoreDuplicates: true });
    await supabase.from("tag_suggestions").insert({
      proposal_id: proposalId,
      suggested_by: user.id,
      label,
      tag_id: existingTag.id,
      status: "approved",
    });
  } else {
    await supabase.from("tag_suggestions").insert({
      proposal_id: proposalId,
      suggested_by: user.id,
      label,
      tag_id: existingTag?.id ?? null,
      status: isOwner ? "owner_approved" : "pending",
    });
  }

  revalidatePath(`/proposals/${proposalId}`);
  return {};
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
// "We the people", highest = the final decision-maker/top of the
// chain). Omitting it appends at the end, same as the old behavior.
//
// Looks up the shared decision_makers registry by name first (case-
// insensitive) so re-typing "Streets Department" reuses the same row
// instead of creating a duplicate; creates a new registry entry only if
// nothing matched.
//
// Decision-maker only now — funding used to be a second node_type here,
// but it's moved to proposal_phases (see migration_phases.sql and
// addPhase below). The chain is purely the approval path ("who has to
// say yes"); funding is something you secure during implementation, not
// something you need permission for.
//
// Open to the whole community, not just the proposal owner — the chain
// is meant to be a shared, crowdsourced record. The owner's own
// additions still land approved immediately; anyone else's land
// 'pending' until the owner approves or removes them.
export async function addPowerTreeNode(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const note = String(formData.get("note") ?? "").trim();
  const insertIndexRaw = formData.get("insert_index");

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) throw new Error("Proposal not found.");
  const isOwner = proposal.owner_id === user.id;

  const rawName = String(formData.get("decision_maker_name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "other");
  if (!rawName) throw new Error("Pick or name a decision-maker.");
  // Same server-side backstop as every other required field here — the
  // form's own `required` attribute is the real UX, this just makes sure
  // a role can't slip through empty via a direct submit. Was optional;
  // Samantha's call to require at least a best guess, since a chain full
  // of names with no stated role doesn't say what any of them need to do.
  if (!note) throw new Error("Add a role for this decision-maker — even a best guess is fine.");

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
  const decisionMakerId = decisionMaker.id;

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
      decision_maker_id: decisionMakerId,
      note: note || null,
      sort_order: existingIds.length, // placeholder — reindexed below
      status: isOwner ? "approved" : "pending",
      submitted_by: user.id,
    })
    .select("id")
    .single();
  if (insertError || !newNode) {
    throw new Error(insertError?.message ?? "Could not add that link.");
  }

  const insertIndex =
    insertIndexRaw != null && insertIndexRaw !== ""
      ? Math.max(0, Math.min(existingIds.length, Number(insertIndexRaw)))
      : existingIds.length;
  existingIds.splice(insertIndex, 0, newNode.id);
  await reindexPowerTreeNodes(supabase, existingIds);

  revalidatePath(`/proposals/${proposalId}`);
}

// Marks a chain link as actually done — this decision-maker really
// engaged. Deliberately not a permission gate on anything else, just a
// visual, motivating progress marker; owner-only to keep it consistent
// with the rest of the chain-editing actions (approve, remove, reorder),
// even though notes/updates themselves stay open to everyone.
export async function toggleNodeCompleted(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const nodeId = String(formData.get("node_id"));
  const completed = formData.get("completed") === "true";

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can mark a chain link done.");
  }

  await supabase
    .from("proposal_power_tree_nodes")
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq("id", nodeId);

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

// ---------------------------------------------------------------------------
// Project Phases — the "how does this actually get done" list, separate
// from the decision chain above. See migration_phases.sql for why this
// exists and where funding went. Same crowdsourced-suggestion shape as
// the chain (open to add, owner approves/removes/toggles progress), and
// now also the same drag-reorder-and-insert-at-any-gap behavior as the
// chain (see reorderPhases and the insert_index handling below) — phases
// used to only ever append at the end, but that read as "just keep
// adding on top of each other" with no way to slot a step in between two
// existing ones, which was a real complaint.
// ---------------------------------------------------------------------------

// Same full-reindex approach as reindexPowerTreeNodes — rewrites
// sort_order = array position for the whole ordered list in one go, so
// both "insert at a specific spot" and drag reorder share one code path
// instead of two different partial-shift implementations.
async function reindexPhases(
  supabase: ReturnType<typeof createClient>,
  orderedIds: string[]
) {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("proposal_phases").update({ sort_order: index }).eq("id", id)
    )
  );
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    console.error(
      "reindexPhases: one or more sort_order updates failed",
      failed.map((r) => r.error?.message)
    );
  }
}

// Anyone signed in can suggest a phase; the owner's own additions land
// approved immediately, anyone else's land pending until the owner
// approves or removes them — identical trust model to addPowerTreeNode.
// insert_index is a 0-based position in the phase list (0 = right after
// the fixed "Map your decision chain" anchor); omitting it appends at
// the end, same as the old always-append behavior.
export async function addPhase(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const label = String(formData.get("label") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const insertIndexRaw = formData.get("insert_index");
  if (!label) throw new Error("A phase needs at least a short label.");

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) throw new Error("Proposal not found.");
  const isOwner = proposal.owner_id === user.id;

  const { data: existingPhases } = await supabase
    .from("proposal_phases")
    .select("id, sort_order")
    .eq("proposal_id", proposalId)
    .order("sort_order", { ascending: true });
  const existingIds = (existingPhases ?? []).map((p) => p.id);

  const { data: newPhase, error } = await supabase
    .from("proposal_phases")
    .insert({
      proposal_id: proposalId,
      label,
      note: note || null,
      sort_order: existingIds.length, // placeholder — reindexed below
      status: isOwner ? "approved" : "pending",
      added_by: user.id,
    })
    .select("id")
    .single();
  if (error || !newPhase) throw new Error(error?.message ?? "Could not add that phase.");

  const insertIndex =
    insertIndexRaw != null && insertIndexRaw !== ""
      ? Math.max(0, Math.min(existingIds.length, Number(insertIndexRaw)))
      : existingIds.length;
  existingIds.splice(insertIndex, 0, newPhase.id);
  await reindexPhases(supabase, existingIds);

  revalidatePath(`/proposals/${proposalId}`);
}

// Full drag-and-drop reorder, same shape as reorderPowerTreeNodes — the
// client sends every phase id in its new order and this just reindexes
// to match.
export async function reorderPhases(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const orderedIds = formData.getAll("phase_id").map(String);

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can reorder its phases.");
  }
  if (orderedIds.length === 0) return;

  await reindexPhases(supabase, orderedIds);

  revalidatePath(`/proposals/${proposalId}`);
}

// Owner-only: flips a community-suggested phase from pending to
// approved — same as approvePowerTreeNode.
export async function approvePhase(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const phaseId = String(formData.get("phase_id"));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can approve suggestions.");
  }

  await supabase
    .from("proposal_phases")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", phaseId);

  revalidatePath(`/proposals/${proposalId}`);
}

// Owner-only. Rejecting a suggested phase is just this — no separate
// "reject" action, same pattern as the decision chain.
export async function removePhase(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const phaseId = String(formData.get("phase_id"));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can edit its phases.");
  }

  await supabase.from("proposal_phases").delete().eq("id", phaseId);

  revalidatePath(`/proposals/${proposalId}`);
}

// Owner-only: moves a phase between not_started / in_progress / done —
// a visual, motivating progress marker, same spirit as the chain's
// completed toggle, just three states instead of two since "in
// progress" is a meaningful, real state for something like "securing
// funding" in a way it wasn't for "did this decision-maker sign off."
export async function updatePhaseProgress(formData: FormData) {
  const { supabase, user } = await requireUser();

  const proposalId = String(formData.get("proposal_id"));
  const phaseId = String(formData.get("phase_id"));
  const progress = String(formData.get("progress") ?? "not_started");
  if (!["not_started", "in_progress", "done"].includes(progress)) return;

  const { data: proposal } = await supabase
    .from("proposals")
    .select("owner_id")
    .eq("id", proposalId)
    .single();
  if (proposal?.owner_id !== user.id) {
    throw new Error("Only the proposal owner can update phase progress.");
  }

  await supabase
    .from("proposal_phases")
    .update({ progress, updated_at: new Date().toISOString() })
    .eq("id", phaseId);

  revalidatePath(`/proposals/${proposalId}`);
}
