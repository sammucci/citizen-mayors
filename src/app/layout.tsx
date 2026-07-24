import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Citizen Mayors",
  description:
    "If you were mayor of Philadelphia — propose it, discuss it, improve it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold">
              Citizen Mayors
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/proposals/new" className="font-medium">
                New proposal
              </Link>
              <Link href="/login">Sign in</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
