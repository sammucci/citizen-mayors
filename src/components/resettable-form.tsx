"use client";

import { useRef } from "react";

// Wraps a server action so the form actually clears itself after a
// successful submit. Plain <form action={serverAction}> forms don't
// reset their fields the way a real full-page POST would — Next.js
// intercepts the submit and does a data refresh instead, so whatever you
// typed just sits there with no sign it went through. That made it look
// like posting a comment or publishing a new version hadn't worked,
// which is exactly the kind of thing that invites someone to hit submit
// again and create a duplicate.
export function ResettableForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleAction(formData: FormData) {
    await action(formData);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={handleAction} className={className}>
      {children}
    </form>
  );
}
