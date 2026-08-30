-- The real, live petition link (e.g. on Change.org), once one exists.
-- Only meaningful on a phase whose label reads as a petition (see
-- isPetitionPhase in phases-section.tsx) — null on every other phase.
-- Owner pastes it in after actually creating the petition elsewhere;
-- once set, it becomes the primary "Sign the petition" link on this
-- phase and in the "active petition" banner at the top of the proposal
-- page, instead of just the generic Change.org starter link.
alter table public.proposal_phases add column if not exists petition_url text;
