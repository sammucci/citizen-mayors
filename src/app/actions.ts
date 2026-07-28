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
// just what someone tells us. But zip and district are both meant to
// describe the SAME place, and nothing stopped someone from picking a
// zip in one part of the city and a district from somewhere else
// entirely (e.g. 19122 with District 10) — checked here against the
// same zip_council_districts crosswalk the proposal form uses. A zip
// that maps to more than one district, or isn't in the crosswalk at
// all, isn't blocked — the data just isn't precise enough yet to
// second-guess what someone picked.
export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to sign in first.");

  const displayName = String(formData.get("display_name") ?? "").trim();
  const zipCode = String(formData.get("zip_code") ?? "").trim();
  const councilDistrictRaw = formData.get("council_district");
  const councilDistrict = councilDistrictRaw ? Number(councilDistrictRaw) : null;
  const ageRange = String(formData.get("age_range") ?? "").trim();
  const raceEthnicity = String(formData.get("race_ethnicity") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const housingStatus = String(formData.get("housing_status") ?? "").trim();
  // Shown on the person's PUBLIC profile (/u/[id]) — the one free-text
  // field on this form that isn't treated as private demographic data.
  // Capped well short of the input's own good sense, just so a pasted
  // wall of text can't blow out the public profile card's layout.
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 280);

  if (zipCode && councilDistrict) {
    const { data: matches } = await supabase
      .from("zip_council_districts")
      .select("council_district")
      .eq("zip_code", zipCode);

    if (matches && matches.length > 0) {
      const validDistricts = matches.map((m) => m.council_district);
      if (!validDistricts.includes(councilDistrict)) {
        return {
          error:
            validDistricts.length === 1
              ? `Zip ${zipCode} is in District ${validDistricts[0]}, not District ${councilDistrict} — double check which one's right.`
              : `Zip ${zipCode} doesn't match District ${councilDistrict} — it's in ${validDistricts
                  .map((d) => `District ${d}`)
                  .join(" or ")}.`,
        };
      }
    }
  }

  await supabase
    .from("profiles")
    .update({
      display_name: displayName || undefined,
      zip_code: zipCode || null,
      council_district: councilDistrict,
      age_range: ageRange || null,
      race_ethnicity: raceEthnicity || null,
      gender: gender || null,
      housing_status: housingStatus || null,
      bio: bio || null,
    })
    .eq("id", user.id);

  revalidatePath("/profile");
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/");
  return {};
}

function isNonEmptyFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).arrayBuffer === "function" &&
    typeof (value as any).size === "number" &&
    (value as any).size > 0
  );
}

// Same pattern as the proposal cover-image upload: saves to a fixed path
// per user (with upsert) so re-uploading just replaces the old avatar
// instead of piling up orphaned files, and returns an error string
// instead of throwing so a too-large file or storage hiccup shows a real
// message next to the picker instead of just doing nothing.
export async function updateAvatar(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to sign in first.");

  const file = formData.get("avatar");
  if (!isNonEmptyFile(file)) {
    return { error: "Choose an image file first." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) {
    console.error("updateAvatar: storage upload failed", uploadError);
    const msg = uploadError.message ?? "";
    if (/size|large|payload|413/i.test(msg)) {
      return { error: "Your image is too big — try a smaller file (under 20MB)." };
    }
    return { error: "That image couldn't be uploaded. Try a different file." };
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust so the new photo actually shows up right away — same
  // upload path every time means the URL never otherwise changes, and
  // browsers (and Next's image handling) will happily keep showing the
  // old cached one.
  const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);
  if (updateError) {
    console.error("updateAvatar: saving avatar_url failed", updateError);
    return { error: "Photo uploaded, but saving it to your profile failed. Try again." };
  }

  revalidatePath("/profile");
  revalidatePath("/");
  return {};
}
