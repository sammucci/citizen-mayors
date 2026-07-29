// DEPRECATED — superseded by the funding-as-chain-node redesign.
//
// Funding used to be a single proposal-wide flag (proposals.funding_needed)
// plus this flat "Funding leads" list underneath the decision chain. That
// didn't capture a project needing money at more than one distinct stage
// (e.g. permitting, then construction), so funding is now its own node
// type inside the decision chain itself — see power-tree-chain.tsx (the
// "💰 Funding" option in the gap-inserter's type picker) and
// power-tree-node-card.tsx (rendering a funding node).
//
// Left as an empty, no-op module rather than deleted outright: this
// project is delivered as a src/+supabase overlay onto an existing
// checkout, and an overlay can add or change a file but can't reliably
// delete one from the destination filesystem. Safe to actually delete
// this file by hand once you're applying this on top of your own repo.
export {};
