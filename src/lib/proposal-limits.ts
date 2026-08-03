// Shared between proposals/actions.ts (server-side enforcement) and
// tag-picker.tsx (client-side display) so the two can never drift apart
// — a plain constant can't live inside actions.ts itself since a "use
// server" file can only export async functions.
export const MAX_TAGS_PER_PROPOSAL = 10;
