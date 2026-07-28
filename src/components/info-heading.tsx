// Shared version of the hover/focus info-icon pattern first built for
// "Who's showing up" on the community dashboard — a heading with a
// small (i) icon next to it; hovering or focusing the icon reveals the
// explanatory text that used to sit as permanent subtext under the
// heading. Keeps sections compact (the label, not a paragraph, is what
// you see by default) while the explanation is still one hover away,
// not deleted.
export function InfoHeading({
  as: Tag = "p",
  tooltip,
  className,
  children,
}: {
  as?: "h2" | "h3" | "p";
  tooltip: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag className={`group relative inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {children}
      <span
        tabIndex={0}
        className="flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full bg-duty-purple text-[10px] font-bold leading-none text-white shadow-sm outline-none transition hover:scale-110 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-duty-purple/50 focus-visible:ring-offset-2"
        aria-label="More info"
      >
        i
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-10 mt-1.5 hidden w-72 rounded-md border border-neutral-200 bg-white p-2.5 text-xs font-normal normal-case text-neutral-600 shadow-md group-hover:block group-focus-within:block">
        {tooltip}
      </span>
    </Tag>
  );
}
