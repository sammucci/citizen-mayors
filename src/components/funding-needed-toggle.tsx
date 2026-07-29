// DEPRECATED — superseded by the funding-as-chain-node redesign.
//
// This was an owner-only toggle for a single proposal-wide
// "funding_needed" flag. Funding is now its own node type inserted
// directly into the decision chain (see power-tree-chain.tsx's "💰
// Funding" option and power-tree-node-card.tsx), so there's no longer a
// single flag to toggle — a proposal can have zero, one, or several
// funding nodes at whatever points in the chain actually need money.
//
// Left as an empty, no-op module rather than deleted outright — see the
// same note in funding-leads-section.tsx for why.
export {};
