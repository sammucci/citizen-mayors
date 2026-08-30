import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { FeedbackWidget } from "@/components/feedback-widget";
import { getNotifications } from "@/lib/notifications";

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
  let notificationItems: Awaited<ReturnType<typeof getNotifications>>["items"] = [];
  let pendingNotificationItems: Awaited<ReturnType<typeof getNotifications>>["pendingItems"] = [];
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    displayName = profile?.display_name ?? user.email ?? null;
    isAdmin = profile?.is_admin ?? false;
    const notifications = await getNotifications(supabase, user.id);
    notificationItems = notifications.items;
    pendingNotificationItems = notifications.pendingItems;
  }

  return (
    <html lang="en" className={roboto.className}>
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex flex-col leading-tight">
              <span className="text-lg font-semibold">
                <span className="text-duty-red">Citizen</span>{" "}
                <span className="text-duty-purple">Mayors</span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                of Philadelphia
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/community-dashboard" className="text-neutral-600 hover:text-neutral-900">
                Community
              </Link>
              {/* Was only reachable by clicking through a specific
                  proposal's decision chain — the index page itself
                  (src/app/decision-makers/page.tsx) already existed but
                  had no link anywhere in the nav, so there was no way to
                  just go browse it directly. "Leadership" in the nav,
                  same /decision-makers URL underneath (organizations
                  still live at their own /organizations, unlinked here
                  on purpose — this is specifically about the elected-
                  official/department/board hierarchy, not every group
                  a resident might list on their own profile). */}
              <Link href="/decision-makers" className="text-neutral-600 hover:text-neutral-900">
                Leadership
              </Link>
              <Link
                href="/proposals/new"
                className="rounded-full bg-duty-purple px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                New proposal
              </Link>
              {user && (
                <NotificationBell items={notificationItems} pendingItems={pendingNotificationItems} />
              )}
              {user ? (
                <UserMenu displayName={displayName ?? "there"} isAdmin={isAdmin} />
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <FeedbackWidget />
      </body>
    </html>
  );
}
