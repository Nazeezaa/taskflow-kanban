-- KPI Integration migration (per INTEGRATION-graphic.md)
-- Maps spec → repo reality. See comments inline.

-- ============================================================
-- cards: add revision_count, brand_fit (KPI inputs)
-- ============================================================
alter table cards add column if not exists revision_count int default 0;
alter table cards add column if not exists brand_fit numeric(3,1);  -- 0-10, nullable

-- ============================================================
-- profiles ≈ spec's "users" table.
-- Add line_user_id (nullable; designers without it are skipped in KPI).
-- ============================================================
alter table profiles add column if not exists line_user_id text;

-- Unique index on line_user_id (only when not null)
create unique index if not exists profiles_line_user_id_uniq
  on profiles(line_user_id)
  where line_user_id is not null;

-- ============================================================
-- card_members: drop legacy FK to members(id) so we can use profiles.id
-- (auth-based members live in profiles, not the legacy seed `members` table)
-- ============================================================
alter table card_members
  drop constraint if exists card_members_member_id_fkey;

-- ============================================================
-- Indexes for KPI query performance
-- Spec asked for: idx_cards(completed_at, assignee_id) where status='done'
-- Repo equivalent: completion is tracked by completed_at IS NOT NULL
-- (set automatically when card moved to list with "เสร็จ"/"โพส")
-- ============================================================
create index if not exists idx_cards_completed_at
  on cards(completed_at)
  where completed_at is not null;

create index if not exists idx_card_members_member_id
  on card_members(member_id);

-- ============================================================
-- Default RLS for new columns: inherit from existing "allow all"
-- (No new policies needed — table policies already permit access)
-- ============================================================
