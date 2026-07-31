"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Same pattern as proposals/actions.ts and decision-makers/actions.ts.
async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_blocked, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_blocked) {
    throw new Error("Your account has been blocked from posting. Contact the site admin if you think this is a mistake.");
  }

  return { supabase, user, isAdmin: Boolean(profile?.is_admin) };
}

async function logRevision(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  editedBy: string
) {
  if ((oldValue ?? "") === (newValue ?? "")) return;
  await supabase.from("organization_revisions").insert({
    organization_id: organizationId,
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
    edited_by: editedBy,
  });
}

// Same match-or-create pattern as grants/decision-makers: reuse the
// existing registry row if an org with this name (case-insensitive)
// already exists, otherwise add a new one. Then attaches it to the
// current user's own profile — this is the "neighborhood groups and
// civic organizations near me" flow on the profile page. Silently a
// no-op if you've already attached this org (the unique constraint on
// profile_organizations would otherwise throw).
export async function addOrganizationToMyProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  let organizationId = existingOrg?.id as string | undefined;
  if (!organizationId) {
    const { data: newOrg, error } = await supabase
      .from("organizations")
      .insert({ name, added_by: user.id })
      .select("id")
      .single();
    if (error || !newOrg) return;
    organizationId = newOrg.id;
  }

  const { data: alreadyAttached } = await supabase
    .from("profile_organizations")
    .select("id")
    .eq("profile_id", user.id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (alreadyAttached) {
    revalidatePath("/profile");
    return;
  }

  await supabase.from("profile_organizations").insert({
    profile_id: user.id,
    organization_id: organizationId,
  });

  revalidatePath("/profile");
  revalidatePath(`/organizations/${organizationId}`);
}

export async function removeOrganizationFromMyProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organizationId = String(formData.get("organization_id"));

  await supabase
    .from("profile_organizations")
    .delete()
    .eq("profile_id", user.id)
    .eq("organization_id", organizationId);

  revalidatePath("/profile");
  revalidatePath(`/organizations/${organizationId}`);
}

export async function updateOrganizationStructuredFields(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organizationId = String(formData.get("organization_id"));

  const areaRepresented = (formData.get("area_represented") as string | null)?.trim() || null;
  const meetsWhen = (formData.get("meets_when") as string | null)?.trim() || null;
  const meetsWhere = (formData.get("meets_where") as string | null)?.trim() || null;
  const topics = (formData.get("topics") as string | null)
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean) ?? [];

  const { data: existing } = await supabase
    .from("organization_profiles")
    .select("area_represented, meets_when, meets_where, topics")
    .eq("organization_id", organizationId)
    .maybeSingle();

  await supabase.from("organization_profiles").upsert({
    organization_id: organizationId,
    area_represented: areaRepresented,
    meets_when: meetsWhen,
    meets_where: meetsWhere,
    topics,
    updated_at: new Date().toISOString(),
  });

  const fieldsToLog: [string, string | null, string | null][] = [
    ["area_represented", existing?.area_represented ?? null, areaRepresented],
    ["meets_when", existing?.meets_when ?? null, meetsWhen],
    ["meets_where", existing?.meets_where ?? null, meetsWhere],
    [
      "topics",
      existing?.topics ? existing.topics.join(", ") : null,
      topics.length > 0 ? topics.join(", ") : null,
    ],
  ];
  for (const [field, oldVal, newVal] of fieldsToLog) {
    await logRevision(supabase, organizationId, field, oldVal, newVal, user.id);
  }

  revalidatePath(`/organizations/${organizationId}`);
}

export async function updateOrganizationDescription(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organizationId = String(formData.get("organization_id"));
  const description = String(formData.get("description") ?? "");

  const { data: existing } = await supabase
    .from("organization_profiles")
    .select("description")
    .eq("organization_id", organizationId)
    .maybeSingle();

  await supabase.from("organization_profiles").upsert({
    organization_id: organizationId,
    description,
    updated_at: new Date().toISOString(),
  });

  await logRevision(supabase, organizationId, "description", existing?.description ?? null, description, user.id);

  revalidatePath(`/organizations/${organizationId}`);
}
