-- Optional, one-time backfill — NOT required to deploy v113.
--
-- Going forward, createProposal() (see proposals/actions.ts) gives every
-- new proposal's owner an automatic +1 upvote on their own proposal
-- (posting it is itself a statement of support). That only applies to
-- proposals created AFTER v113 ships — it doesn't touch anything already
-- in the database.
--
-- Run this if you also want every EXISTING proposal's owner to get that
-- same automatic +1, so old and new proposals are consistent. This will
-- visibly change the "net support" number on every existing proposal
-- that doesn't already have an owner upvote (owners who already voted on
-- their own proposal are untouched — see the "not exists" check below,
-- which is what prevents a duplicate row for them).
--
-- Safe to run more than once (the not-exists check makes it idempotent).
insert into public.reactions (user_id, proposal_id, comment_id, value)
select p.owner_id, p.id, null, 1
from public.proposals p
where not exists (
  select 1 from public.reactions r
  where r.proposal_id = p.id
    and r.user_id = p.owner_id
    and r.comment_id is null
);
