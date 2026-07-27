// Server-side verification of a Cloudflare Turnstile token.
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    // Not configured yet (e.g. before a Cloudflare Turnstile site has been
    // created for this project) — fail open so sign-in isn't accidentally
    // blocked for everyone. Once TURNSTILE_SECRET_KEY is set in Vercel's
    // environment variables, this starts actually enforcing.
    return true;
  }

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    }
  );

  const data = await res.json();
  return Boolean(data.success);
}
