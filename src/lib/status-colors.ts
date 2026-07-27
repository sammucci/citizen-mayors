// Color-codes a suggested-edit's resolution status so the meaning reads at
// a glance: green for accepted, amber for accepted-with-contingency, red
// for rejected, neutral blue while still open/undecided. Shared between
// the proposal page (where the decision gets made) and the profile page
// (where a commenter sees the outcome on their own suggestions).
export function statusColorClasses(status: string): string {
  switch (status) {
    case "accepted":
      return "bg-green-50 text-green-700";
    case "accepted_with_contingency":
      return "bg-amber-50 text-amber-700";
    case "rejected":
      return "bg-red-50 text-duty-red";
    default:
      return "bg-blue-50 text-blue-700";
  }
}
