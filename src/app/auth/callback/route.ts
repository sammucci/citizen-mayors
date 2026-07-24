import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the redirect back from a magic-link email or Google OAuth,
// exchanges the code for a session, then makes sure a profile row exists.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    const user = data.user;
    if (user) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("profiles").insert({
          id: user.id,
          display_name: user.email?.split("@")[0] ?? "New mayor",
        });
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
