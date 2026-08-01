"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Same pattern as proposals/actions.ts and organizations/actions.ts.
async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Lets a resident mark a tag as something they're interested in or have
// expertise in — see profile_followed_tags in schema.sql. This is the
// "crowdsourced expertise" feature: it drives the notification-bell
// alert (getNotifications() in lib/notifications.ts) when a proposal
// shows up carrying one of these tags, whether brand-new or an existing
// proposal that just got tagged with it. upsert (not select-then-insert)
// makes this a no-op if you're already following the tag, same
// idempotent-attach idea as addOrganizationToMyProfile.
export async function followTag(formData: FormData) {
  const { supabase, user } = await requireUser();
  const tagId = Number(formData.get("tag_id"));
  if (!tagId) return;

  await supabase
    .from("profile_followed_tags")
    .upsert({ profile_id: user.id, tag_id: tagId }, { onConflict: "profile_id,tag_id" });

  revalidatePath("/profile");
}

export async function unfollowTag(formData: FormData) {
  const { supabase, user } = await requireUser();
  const tagId = Number(formData.get("tag_id"));

  await supabase
    .from("profile_followed_tags")
    .delete()
    .eq("profile_id", user.id)
    .eq("tag_id", tagId);

  revalidatePath("/profile");
}
