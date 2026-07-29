import { redirect } from "next/navigation";

// Merged into /admin/tags (pending suggestions + the full tag registry,
// one page instead of two) — this route stays as a redirect rather than
// a 404, in case anyone still has it bookmarked.
export default function TagSuggestionsAdminPage() {
  redirect("/admin/tags");
}
