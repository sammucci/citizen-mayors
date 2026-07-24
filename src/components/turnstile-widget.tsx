"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void }
      ) => void;
    };
  }
}

// Invisible-by-default Cloudflare Turnstile widget. Most real visitors never
// see anything; it only escalates to a simple checkbox for suspicious traffic.
export function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return; // not configured yet — no-op locally

    const scriptId = "cf-turnstile-script";
    function render() {
      if (ref.current && window.turnstile) {
        window.turnstile.render(ref.current, {
          sitekey: siteKey!,
          callback: onToken,
        });
      }
    }

    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      document.body.appendChild(script);
    } else {
      render();
    }
  }, [onToken]);

  return <div ref={ref} />;
}
