"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Same "grows as you use it" idea as decision_makers: if the category
// someone typed for volunteer hours isn't already in the shared
// registry, add it (case-insensitive match reused if it exists) so the
// next person logging hours sees it as a suggestion instead of
// retyping a near-duplicate. Best-effort — a failure here shouldn't
// block saving the actual log entry, so errors are swallowed.
async function ensureVolunteerCategory(
  supabase: ReturnType<typeof createClient>,
  category: string
) {
  if (!category) return;
  const { data: existing } = await supabase
    .from("volunteer_categories")
    .select("id")
    .ilike("label", category)
    .maybeSingle();
  if (!existing) {
    await supabase.from("volunteer_categories").insert({ label: category });
  }
}

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Shared field extraction — every one of these actions reads the same
// set of fields off the same form, just with different validation and
// a different destination (insert vs. update, draft vs. published).
function readFields(formData: FormData) {
  return {
    logType: String(formData.get("log_type") ?? ""),
    occurredOn: String(formData.get("occurred_on") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    published: formData.get("published") === "on",
    publishedLink: String(formData.get("published_link") ?? "").trim(),
    organization: String(formData.get("organization") ?? "").trim(),
    contactMethod: String(formData.get("contact_method") ?? "").trim(),
    hoursRaw: String(formData.get("hours") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
  };
}

function buildRow(f: ReturnType<typeof readFields>, status: "draft" | "published") {
  return {
    log_type: f.logType,
    occurred_on: f.occurredOn || new Date().toISOString().slice(0, 10),
    title: f.logType === "letter_to_editor" && f.title ? f.title : null,
    published: f.logType === "letter_to_editor" ? f.published : false,
    published_link: f.logType === "letter_to_editor" && f.publishedLink ? f.publishedLink : null,
    // Reused for both community_meeting (hosted by) and
    // contacted_official (who/which office was contacted).
    organization:
      (f.logType === "community_meeting" || f.logType === "contacted_official") && f.organization
        ? f.organization
        : null,
    contact_method: f.logType === "contacted_official" && f.contactMethod ? f.contactMethod : null,
    hours: f.logType === "volunteer_hours" && f.hoursRaw ? Number(f.hoursRaw) : null,
    category: f.logType === "volunteer_hours" && f.category ? f.category : null,
    note: f.note || null,
    status,
  };
}

const LOG_TYPES = [
  "letter_to_editor",
  "community_meeting",
  "volunteer_hours",
  "testimony",
  "contacted_official",
];

// Adds one finished, "published" log entry — this is the normal
// deliberate submit path (as opposed to saveDraftCivicLog, which is
// the auto-save-on-close safety net for an unfinished one).
export async function addCivicLog(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const f = readFields(formData);

  if (!LOG_TYPES.includes(f.logType)) return { error: "Pick what kind of log this is." };
  if (f.logType === "volunteer_hours" && (!f.hoursRaw || Number(f.hoursRaw) <= 0)) {
    return { error: "Enter how many hours you volunteered." };
  }

  const { error } = await supabase
    .from("civic_logs")
    .insert({ user_id: user.id, ...buildRow(f, "published") });

  if (error) return { error: "Couldn't save that log entry. Try again." };

  if (f.logType === "volunteer_hours" && f.category) {
    await ensureVolunteerCategory(supabase, f.category);
  }

  revalidatePath("/profile");
  return {};
}

// Auto-save safety net: called when the add-a-log window closes
// (backdrop click, Escape, or the ✕) while there's unsaved content in
// a BRAND NEW entry, so a half-finished log never just vanishes.
// Landed as a 'draft' — visible only on your own profile, excluded
// from your public report card counts until you finish it.
export async function saveDraftCivicLog(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const f = readFields(formData);
  if (!LOG_TYPES.includes(f.logType)) return {};

  const { error } = await supabase
    .from("civic_logs")
    .insert({ user_id: user.id, ...buildRow(f, "draft") });

  if (error) return { error: "Couldn't save that draft." };

  revalidatePath("/profile");
  return {};
}

// Same auto-save safety net, but for an EXISTING draft you reopened to
// finish — updates that same row instead of inserting a new one. Every
// edit to an unfinished log used to insert yet another draft row on
// close, so the list of "unfinished" logs kept growing instead of just
// reflecting the one you were actually working on.
export async function updateDraftCivicLog(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const f = readFields(formData);
  if (!id || !LOG_TYPES.includes(f.logType)) return {};

  const { error } = await supabase
    .from("civic_logs")
    .update(buildRow(f, "draft"))
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Couldn't save that draft." };

  revalidatePath("/profile");
  return {};
}

// Turns a draft into a finished, published log entry — reuses the same
// row (update, not a new insert) so finishing a draft doesn't leave an
// orphaned duplicate behind.
export async function publishCivicLogDraft(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const f = readFields(formData);

  if (f.logType === "volunteer_hours" && (!f.hoursRaw || Number(f.hoursRaw) <= 0)) {
    return { error: "Enter how many hours you volunteered." };
  }

  const { error } = await supabase
    .from("civic_logs")
    .update(buildRow(f, "published"))
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Couldn't save that log entry. Try again." };

  if (f.logType === "volunteer_hours" && f.category) {
    await ensureVolunteerCategory(supabase, f.category);
  }

  revalidatePath("/profile");
  return {};
}

export async function deleteCivicLog(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));

  await supabase.from("civic_logs").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/profile");
}
