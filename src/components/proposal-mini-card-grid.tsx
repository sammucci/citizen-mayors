import Link from "next/link";

export type ProposalMiniCardData = {
  id: string;
  title: string;
  type: string;
  imageUrl: string | null;
  imagePositionX: number | null;
  imagePositionY: number | null;
  categoryLabel: string | null;
  categoryColor: string | null;
  // Optional small caption under the category/type line — e.g. "(suggested,
  // not yet approved)" on a decision-maker's profile. Not used on the
  // profile page's "Your proposals," where every entry is a real one of
  // your own.
  note?: string;
};

// The two-column "mini card" — square image thumbnail on one side,
// title/category/type on the other, tinted with the category color —
// first built for the profile page's "Your proposals" list. Pulled out
// into its own shared component so the decision-maker profile's "Shows
// up in N proposals" can use the exact same treatment instead of a
// plainer link list, and so any future page that lists proposals (org
// profiles, next) gets it for free instead of a fresh copy-paste.
export function ProposalMiniCardGrid({
  proposals,
  emptyText,
}: {
  proposals: ProposalMiniCardData[];
  emptyText: string;
}) {
  if (proposals.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyText}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {proposals.map((p) => {
        const color = p.categoryColor ?? "#e5e5e5";
        return (
          <li
            key={p.id}
            className="flex items-center overflow-hidden rounded-lg border"
            style={{ backgroundColor: `${color}1a`, borderColor: `${color}66` }}
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden" style={{ backgroundColor: color }}>
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{
                    objectPosition: `${p.imagePositionX ?? 50}% ${p.imagePositionY ?? 50}%`,
                  }}
                />
              )}
            </div>
            <div className="min-w-0 p-2">
              <Link href={`/proposals/${p.id}`} className="block truncate text-sm font-semibold hover:underline">
                {p.title}
              </Link>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-neutral-500">
                {p.categoryLabel}
                {p.categoryLabel ? " · " : ""}
                {p.type}
              </p>
              {p.note && <p className="mt-0.5 truncate text-[10px] text-neutral-400">{p.note}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
