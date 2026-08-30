"use client";

import { useRouter } from "next/navigation";
import { followTag, unfollowTag } from "@/app/profile/actions";

type TagOption = { id: number; label: string; following: boolean };
type TagGroup = { id: number | string; label: string; tags: TagOption[] };

// The other half of the "crowdsourced expertise" feature (see
// profile_followed_tags in schema.sql) — pick the topics you know about
// or want to weigh in on, grouped exactly the way Samantha groups them
// in the admin tag repository (same query, same order("label")), so
// "where does this tag live" never has two different answers depending
// on which screen you're looking at. Following a tag alerts you (via the
// notification bell — see getNotifications()) when a proposal shows up
// carrying it, whether that's brand-new or an existing proposal that
// just got tagged with it.
export function FollowedTagsSection({ tagGroups }: { tagGroups: TagGroup[] }) {
  const router = useRouter();

  async function toggle(tagId: number, following: boolean) {
    const fd = new FormData();
    fd.set("tag_id", String(tagId));
    if (following) {
      await unfollowTag(fd);
    } else {
      await followTag(fd);
    }
    router.refresh();
  }

  return (
    <div>
      {/* No h2 here — the tab above already says "Expertise & interests";
          see profile-tabbed-sections.tsx. */}
      <p className="text-xs text-neutral-500">
        Pick the topics you know about or want to weigh in on — you&apos;ll get a
        notification when a proposal shows up carrying one of these, new or
        newly tagged with it.
      </p>
      <div className="mt-3 space-y-2">
        {tagGroups.map((group) => {
          const followedCount = group.tags.filter((t) => t.following).length;
          const hasPicks = followedCount > 0;
          return (
            <details
              key={group.id}
              className={`rounded-lg border bg-white ${
                hasPicks ? "border-duty-purple/40" : "border-neutral-200"
              }`}
            >
              {/* Collapsed, every group used to look identical whether it
                  had picks in it or not — the only tell was the small
                  gray count text, easy to miss while scanning down the
                  list. Now a group with at least one followed tag gets a
                  tinted background + purple left bar + bold purple count,
                  so which topics you've already picked from is visible
                  without opening each one. */}
              <summary
                className={`flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border-l-4 px-3 py-2 text-sm font-medium marker:content-none ${
                  hasPicks
                    ? "border-l-duty-purple bg-duty-purple/5"
                    : "border-l-transparent"
                }`}
              >
                <span>{group.label}</span>
                <span
                  className={`shrink-0 text-xs ${
                    hasPicks ? "font-semibold text-duty-purple" : "font-normal text-neutral-400"
                  }`}
                >
                  {hasPicks ? `${followedCount} of ${group.tags.length} followed` : `${group.tags.length} tags`}
                </span>
              </summary>
              <ul className="flex flex-wrap gap-1.5 border-t border-neutral-100 p-3">
                {group.tags.map((tag) => (
                  <li key={tag.id}>
                    <button
                      type="button"
                      onClick={() => toggle(tag.id, tag.following)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        tag.following
                          ? "border-duty-purple bg-duty-purple/10 text-duty-purple"
                          : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {tag.following ? "✓ " : "+ "}
                      {tag.label}
                    </button>
                  </li>
                ))}
                {group.tags.length === 0 && (
                  <li className="text-xs text-neutral-400">No tags in this group yet.</li>
                )}
              </ul>
            </details>
          );
        })}
        {tagGroups.length === 0 && <p className="text-sm text-neutral-500">No tags yet.</p>}
      </div>
    </div>
  );
}
