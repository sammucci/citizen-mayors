import { redirect } from "next/navigation";

// Merged into /admin/tags (one master tags screen: pending suggestions,
// project tags, and volunteer categories/groups all together) — this
// route stays as a redirect rather than a 404, in case anyone still has
// it bookmarked.
export default function VolunteerCategoriesAdminPage() {
  redirect("/admin/tags");
}
