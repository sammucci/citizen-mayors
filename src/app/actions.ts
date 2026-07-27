"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Self-reported, optional. Not geocoded or verified against an address —
// just what someone tells us. (Plausibility-checking this against a zip
// code is planned but not built yet; see project notes.)
export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to sign in first.");

  const displayName = String(formData.get("display_name") ?? "").trim();
  const zipCode = String(formData.get("zip_code") ?? "").trim();
  const councilDistrictRaw = formData.get("council_district");
  const councilDistrict = councilDistrictRaw ? Number(councilDistrictRaw) : null;

  await supabase
    .from("profiles")
    .update({
      display_name: displayName || undefined,
      zip_code: zipCode || null,
      council_district: councilDistrict,
    })
    .eq("id", user.id);

  revalidatePath("/profile");
  revalidatePath("/");
}
