-- Trello import support
-- Adds dedupe column so re-running import doesn't duplicate cards

alter table cards add column if not exists trello_id text;

-- Unique index (only where trello_id is set) — same card never imported twice
create unique index if not exists cards_trello_id_uniq
  on cards(trello_id)
  where trello_id is not null;
