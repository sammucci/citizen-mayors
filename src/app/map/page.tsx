import { redirect } from "next/navigation";

// The map used to live on its own page — merged onto the homepage
// dashboard instead (map + list, one view, no separate nav item). This
// keeps any old bookmarks/links to /map working by sending them home.
export default function MapPage() {
  redirect("/");
}
