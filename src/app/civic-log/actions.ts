"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Adds one finished, "published" log entry — this is the normal
// deliberate submit path (as opposed to saveDraftCivicLog, which is
// the auto-save-on-close safety net for an unfinished one).
export async function addCivicLog(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const logType = String(formData.get("log_type") ?? "");
  if (!["letter_to_editor", "community_meeting", "volunteer_hours", "testimony"].includes(logType)) {
    return { error: "Pick what kind of log this is." };
  }

  const occurredOn = String(formData.get("occurred_on") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const published = formData.get("published") === "on";
  const publishedLink = String(formData.get("published_link") ?? "").trim();
  const hoursRaw = String(formData.get("hours") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (logType === "volunteer_hours" && (!hoursRaw || Number(hoursRaw) <= 0)) {
    return { error: "Enter how many hours you volunteered." };
  }

  const { error } = await supabase.from("civic_logs").insert({
    user_id: user.id,
    log_type: logType,
    occurred_on: occurredOn || new Date().toISOString().slice(0, 10),
    published: logType === "letter_to_editor" ? published : false,
    published_link: logType === "letter_to_editor" && publishedLink ? publishedLink : null,
    hours: logType === "volunteer_hours" ? Number(hoursRaw) : null,
    category: logType === "volunteer_hours" && category ? category : null,
    note: note || null,
    status: "published",
  });

  if (error) return { error: "Couldn't save that log entry. Try again." };

  revalidatePath("/profile");
  return {};
}

// Auto-save safety net: called when the add-a-log window closes
// (backdrop click, Escape, or the ✕) while there's unsaved content in
// the form, so a half-finished log never just vanishes. Landed as a
// 'draft' — visible only on your own profile, with an easy way to
// finish or delete it, and excluded from your public report card
// counts until you do.
export async function saveDraftCivicLog(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const logType = String(formData.get("log_type") ?? "");
  if (!["letter_to_editor", "community_meeting", "volunteer_hours", "testimony"].includes(logType)) {
    return {};
  }

  const occurredOn = String(formData.get("occurred_on") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const published = formData.get("published") === "on";
  const publishedLink = String(formData.get("published_link") ?? "").trim();
  const hoursRaw = String(formData.get("hours") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  const { error } = await supabase.from("civic_logs").insert({
    user_id: user.id,
    log_type: logType,
    occurred_on: occurredOn || new Date().toISOString().slice(0, 10),
    published: logType === "letter_to_editor" ? published : false,
    published_link: logType === "letter_to_editor" && publishedLink ? publishedLink : null,
    hours: logType === "volunteer_hours" && hoursRaw ? Number(hoursRaw) : null,
    category: logType === "volunteer_hours" && category ? category : null,
    note: note || null,
    status: "draft",
  });

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
  const logType = String(formData.get("log_type") ?? "");
  const occurredOn = String(formData.get("occurred_on") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const published = formData.get("published") === "on";
  const publishedLink = String(formData.get("published_link") ?? "").trim();
  const hoursRaw = String(formData.get("hours") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (logType === "volunteer_hours" && (!hoursRaw || Number(hoursRaw) <= 0)) {
    return { error: "Enter how many hours you volunteered." };
  }

  const { error } = await supabase
    .from("civic_logs")
    .update({
      occurred_on: occurredOn || new Date().toISOString().slice(0, 10),
      published: logType === "letter_to_editor" ? published : false,
      published_link: logType === "letter_to_editor" && publishedLink ? publishedLink : null,
      hours: logType === "volunteer_hours" ? Number(hoursRaw) : null,
      category: logType === "volunteer_hours" && category ? category : null,
      note: note || null,
      status: "published",
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Couldn't save that log entry. Try again." };

  revalidatePath("/profile");
  return {};
}

export async function deleteCivicLog(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));

  await supabase.from("civic_logs").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/profile");
}
