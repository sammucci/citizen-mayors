import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export const metadata: Metadata = {
  title: "Citizen Mayors",
  description:
    "If I were mayor of Philadelphia — propose it, discuss it, improve it.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    displayName = profile?.display_name ?? user.email ?? null;
  }

  return (
    <html lang="en">
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold">
              <span className="text-duty-red">Citizen</span>{" "}
              <span className="text-duty-purple">Mayors</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/proposals/new" className="font-medium">
                New proposal
              </Link>
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-neutral-600">
                    Signed in as {displayName}
                  </span>
                  <form action={signOut}>
                    <button type="submit" className="font-medium underline">
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
