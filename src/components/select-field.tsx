"use client";

import { forwardRef } from "react";

// GENERAL RULE, not a one-off fix: a plain `<select className="input">`
// (or any unstyled native select) renders the browser's own dropdown
// arrow flush against the box's right edge, with zero breathing room —
// this has been individually patched at least twice before in this
// codebase (see the old FilterSelect in proposal-filters.tsx) before it
// got pulled into one shared component. From here on, ANY dropdown
// anywhere in the app should render through this component instead of a
// bare `<select>`, so the arrow always has real margin from the edge and
// this bug can't quietly reappear in some new form down the line.
// `appearance-none` strips the OS-native arrow; the inline SVG chevron
// replacing it gets `pr-8` worth of clearance and matches the app's
// neutral/purple palette instead of whatever the OS defaults to.
export const SelectField = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    // Controls the OUTER wrapper's own sizing within whatever it sits
    // in — most selects in this app sit under a <Field> label and
    // should read as a full-width input, same as the text fields around
    // them, so that's the default. A handful of compact, inline admin
    // rows (a "kind" picker next to a name input and a Save button, say)
    // size to their own content instead; pass `false` there. The select
    // itself always fills its own wrapper either way — that part's
    // unconditional and harmless regardless of context.
    fullWidth?: boolean;
    // Extra classes for that outer wrapper rather than the select —
    // needed when the select has to be a flex item that grows
    // (`flex-1 min-w-0` on a row like "Topic [dropdown]"), since that
    // has to live on the wrapper, not on the select inside it. Implies
    // `fullWidth: false` (the wrapper's size is coming from this
    // instead), no need to pass both.
    wrapperClassName?: string;
  }
>(function SelectField(
  { className = "", fullWidth = true, wrapperClassName = "", children, ...props },
  ref
) {
  const sizing = wrapperClassName || (fullWidth ? "w-full" : "inline-block");
  return (
    <div className={`relative ${sizing}`}>
      <select
        ref={ref}
        className={`w-full appearance-none rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-8 text-sm ${className}`}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
      >
        <path
          d="M5 8l5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});
