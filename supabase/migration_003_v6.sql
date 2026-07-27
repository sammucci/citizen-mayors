-- v6 migration: category colors + fixing the reactions duplicate-vote bug.
-- Safe to run even if you've already run earlier migrations.

-- Category colors (editable anytime in Table Editor going forward)
alter table public.categories add column if not exists color text;

update public.categories set color = '#8358D3' where slug = 'public_safety';
update public.categories set color = '#F86767' where slug = 'benefits_pensions';
update public.categories set color = '#4069D9' where slug = 'general_government';
update public.categories set color = '#FFAFCB' where slug = 'infrastructure_sanitation';
update public.categories set color = '#87D183' where slug = 'culture_leisure';
update public.categories set color = '#FFA550' where slug = 'education_subsidies';
update public.categories set color = '#FBE968' where slug = 'governance_process';

-- Fix the duplicate-vote bug: the original unique constraint on
-- (user_id, proposal_id, comment_id) didn't actually stop duplicates when
-- voting on a proposal directly, because comment_id is NULL in that case,
-- and Postgres treats every NULL as unique from every other NULL — so the
-- "prevent duplicate votes" rule silently never applied to proposal votes.

-- First, clean up any duplicate votes the bug already let through, keeping
-- only each person's most recent vote on a given proposal/comment.
delete from public.reactions r
using (
  select id, row_number() over (
    partition by user_id, proposal_id
    order by created_at desc
  ) as rn
  from public.reactions
  where comment_id is null
) ranked
where r.id = ranked.id and ranked.rn > 1;

delete from public.reactions r
using (
  select id, row_number() over (
    partition by user_id, comment_id
    order by created_at desc
  ) as rn
  from public.reactions
  where proposal_id is null
) ranked
where r.id = ranked.id and ranked.rn > 1;

-- Now it's safe to add the real fix: two partial unique indexes (one for
-- proposal votes, one for comment votes) instead of the one combined
-- constraint that had the NULL blind spot.
alter table public.reactions drop constraint if exists reactions_user_id_proposal_id_comment_id_key;

create unique index if not exists reactions_unique_proposal_vote
  on public.reactions (user_id, proposal_id) where comment_id is null;

create unique index if not exists reactions_unique_comment_vote
  on public.reactions (user_id, comment_id) where proposal_id is null;
