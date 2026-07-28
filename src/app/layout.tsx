import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";

// Was falling back to the browser's default sans-serif (Arial-ish on a
// lot of systems) since nothing set a font. Roboto, loaded via
// next/font so it's self-hosted and doesn't need a runtime fetch.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

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
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    displayName = profile?.display_name ?? user.email ?? null;
    isAdmin = profile?.is_admin ?? false;
  }

  return (
    <html lang="en" className={roboto.className}>
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold">
              <span className="text-duty-red">Citizen</span>{" "}
              <span className="text-duty-purple">Mayors</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/proposals/new"
                className="rounded-full bg-duty-purple px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                New proposal
              </Link>
              {user ? (
                <UserMenu displayName={displayName ?? "there"} isAdmin={isAdmin} />
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
