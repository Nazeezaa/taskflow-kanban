-- TaskFlow Kanban - Supabase Schema
-- ใช้ไฟล์นี้สร้างตารางใน Supabase SQL Editor

-- Boards
create table boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  background_color text default '#1a1a2e',
  created_at timestamptz default now()
);

-- Lists
create table lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  title text not null,
  position int not null default 0,
  color text,
  created_at timestamptz default now()
);

-- Labels
create table labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  name text not null,
  color text not null
);

-- Members
create table members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  name text not null,
  initials text not null,
  color text not null,
  avatar_url text
);

-- Cards
create table cards (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references lists(id) on delete cascade,
  title text not null,
  description text default '',
  position int not null default 0,
  due_date timestamptz,
  start_date timestamptz,
  cover_color text,
  cover_image text,
  is_watching boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Card Labels (many-to-many)
create table card_labels (
  card_id uuid references cards(id) on delete cascade,
  label_id uuid references labels(id) on delete cascade,
  primary key (card_id, label_id)
);

-- Card Members (many-to-many)
create table card_members (
  card_id uuid references cards(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  primary key (card_id, member_id)
);

-- Checklists
create table checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  title text not null,
  position int default 0
);

-- Checklist Items
create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references checklists(id) on delete cascade,
  text text not null,
  completed boolean default false,
  position int default 0
);

-- Comments
create table comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  author_name text not null,
  text text not null,
  created_at timestamptz default now()
);

-- Activities (for KPI tracking)
create table activities (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  type text not null, -- 'created', 'moved', 'completed'
  from_list_title text,
  to_list_title text,
  detail text,
  timestamp timestamptz default now()
);

-- Indexes
create index idx_lists_board on lists(board_id);
create index idx_cards_list on cards(list_id);
create index idx_activities_card on activities(card_id);
create index idx_cards_completed on cards(completed_at);

-- Enable Realtime on key tables
alter publication supabase_realtime add table cards;
alter publication supabase_realtime add table lists;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table activities;

-- Row Level Security (เปิดแต่ allow all สำหรับตอนนี้ ค่อยเพิ่ม auth ทีหลัง)
alter table boards enable row level security;
alter table lists enable row level security;
alter table cards enable row level security;
alter table labels enable row level security;
alter table members enable row level security;
alter table checklists enable row level security;
alter table checklist_items enable row level security;
alter table comments enable row level security;
alter table activities enable row level security;
alter table card_labels enable row level security;
alter table card_members enable row level security;

-- Policies (allow all for now)
create policy "allow all" on boards for all using (true) with check (true);
create policy "allow all" on lists for all using (true) with check (true);
create policy "allow all" on cards for all using (true) with check (true);
create policy "allow all" on labels for all using (true) with check (true);
create policy "allow all" on members for all using (true) with check (true);
create policy "allow all" on checklists for all using (true) with check (true);
create policy "allow all" on checklist_items for all using (true) with check (true);
create policy "allow all" on comments for all using (true) with check (true);
create policy "allow all" on activities for all using (true) with check (true);
create policy "allow all" on card_labels for all using (true) with check (true);
create policy "allow all" on card_members for all using (true) with check (true);

-- Seed data
insert into boards (id, title) values ('00000000-0000-0000-0000-000000000001', 'ลุยงาน! Content Marketing');

insert into labels (id, board_id, name, color) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'ด่วน', '#ef4444'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'กำลังทำ', '#f97316'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'ออกแบบ', '#eab308'),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'เสร็จแล้ว', '#22c55e'),
  ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'รอตรวจ', '#3b82f6'),
  ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'แก้ไข', '#a855f7');

insert into members (id, board_id, name, initials, color) values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'สมชาย', 'SC', '#3b82f6'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'วิภา', 'WP', '#ec4899'),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'ธนา', 'TN', '#10b981');

insert into lists (id, board_id, title, position, color) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '📌 Plan & ไอเดีย', 0, '#6366f1'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', '🔥 Fast Lane งานด่วน', 1, '#ef4444'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', '‼️ ปั่นงานด่วนจ้า', 2, '#f97316'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', '👀 QC รอตรวจ', 3, '#eab308'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', '💪 Doing กำลังทำ', 4, '#3b82f6'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', '⚠️ แก้งาน VDO+Artwork', 5, '#a855f7'),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001', '🟢 เสร็จแล้วรอโพสต์', 6, '#22c55e'),
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000001', '✅ เสร็จแล้ว งานแบรนด์อื่น', 7, '#14b8a6'),
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000001', '📦 เสร็จแล้ว ส่งปริ้นแล้ว', 8, '#06b6d4'),
  ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000001', '⚡ โพสแล้ว', 9, '#8b5cf6');
