"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TurnstileWidget } from "@/components/turnstile-widget";

const TURNSTILE_ENABLED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const supabase = createClient();

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (TURNSTILE_ENABLED) {
      if (!turnstileToken) {
        setError("Please complete the verification check below.");
        return;
      }
      const verifyRes = await fetch("/api/verify-turnstile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const { success } = await verifyRes.json();
      if (!success) {
        setError("Verification failed — please try again.");
        return;
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-neutral-600">
        You can browse without an account — signing in is only needed to
        post, comment, or vote.
      </p>

      <button
        onClick={signInWithGoogle}
        className="mt-6 w-full rounded-md border border-neutral-300 py-2 text-sm font-medium hover:bg-neutral-50"
      >
        Continue with Google
      </button>

      <div className="my-4 text-center text-xs text-neutral-400">or</div>

      {sent ? (
        <p className="text-sm text-neutral-700">
          Check {email} for a sign-in link.
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {TURNSTILE_ENABLED && (
            <TurnstileWidget onToken={setTurnstileToken} />
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-duty-blue py-2 text-sm font-medium text-white"
          >
            Send magic link
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
