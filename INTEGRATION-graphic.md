# Graphic App — KPI Integration Spec for HR

> วางไฟล์นี้ที่ root ของ graphic app repo
> ส่งให้ Claude Code: "อ่าน INTEGRATION.md แล้ว implement section Tasks"
> Coordinates with: HR UCT Ready (separate Supabase project)

## Goal

HR app pull KPI ของ designer (Bank + ทีม) จาก `/api/kpi` เดือนละครั้ง เพื่อ compute composite KPI
**ตอนนี้ graphic app ยังไม่มี endpoint นี้ — ต้องสร้างใหม่**

## Contract

### Identity
- Join key: `lineUserId`
- HR's `users.line_user_id` ↔ graphic app's `users.line_user_id`

### Auth
- Header: `x-internal-key: $INTERNAL_API_KEY`

### Period
- Format `YYYY-MM` (calendar month, Asia/Bangkok)

### Frequency
- HR pull วันที่ 1 ของเดือน เวลา 03:05

---

## KPI metrics ที่ต้อง compute

per-designer ต่อเดือน:

| Metric | Source | Formula |
|---|---|---|
| `cardsCompleted` | `cards` table | count where status=done AND completed_at in period |
| `onTimeRate` | cards | count(completed_at ≤ due_date) / cardsCompleted (0-1) |
| `revisionAvg` | cards.revision_count | avg(revision_count) (lower = better) |
| `brandFitScore` | cards.brand_fit (manual กรอกตอน QC) | avg(brand_fit) where not null, 0-10 |
| `contentPerformance` | external/post analytics | engagement rate (optional, null OK) |

---

## Tasks

### Task 1: Schema check / migration

เช็ค Supabase schema ปัจจุบัน — ถ้ายังไม่มี fields เหล่านี้ ให้ทำ migration:

```sql
-- cards table
alter table cards add column if not exists revision_count int default 0;
alter table cards add column if not exists brand_fit numeric(3,1);   -- 0-10
alter table cards add column if not exists due_date timestamptz;
alter table cards add column if not exists completed_at timestamptz;
alter table cards add column if not exists assignee_id uuid references users(id);

-- users table (designers)
alter table users add column if not exists line_user_id text unique;

-- Index for KPI query
create index if not exists idx_cards_completed_assignee 
  on cards(completed_at, assignee_id) 
  where status = 'done';
```

ถ้า field name ใน repo ไม่ตรง (เช่นใช้ `revision_total` แทน `revision_count`) — ปรับ query ใน Task 2 ให้ตรง

### Task 2: Build `/api/kpi` endpoint

#### Spec
```
GET /api/kpi?period=YYYY-MM
Headers: x-internal-key: $INTERNAL_API_KEY
```

#### Response
```json
{
  "period": "2026-05",
  "periodStart": "2026-05-01T00:00:00+07:00",
  "periodEnd": "2026-05-31T23:59:59+07:00",
  "overall": {
    "totalCards": 87,
    "totalDesigners": 1,
    "avgRevisionsPerCard": 1.8,
    "onTimePct": 89
  },
  "byDesigner": [
    {
      "designer": {
        "id": "<uuid>",
        "name": "Bank",
        "lineUserId": "U_xxx"
      },
      "cardsCompleted": 22,
      "onTimeRate": 0.91,
      "revisionAvg": 1.4,
      "brandFitScore": 8.2,
      "contentPerformance": null
    }
  ]
}
```

#### Implementation

```typescript
// api/kpi/index.ts (Vercel API route)
// หรือ supabase/functions/kpi/index.ts (ถ้าใช้ Edge Function)

import { isInternalCall } from '../../lib/internal-auth'
import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (!isInternalCall(req)) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  
  const period = req.query.period as string
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({ error: 'period must be YYYY-MM' })
  }
  
  const { start, end } = parsePeriod(period)
  
  const { data: cards, error } = await supabaseAdmin
    .from('cards')
    .select(`
      id, status, completed_at, due_date, revision_count, brand_fit,
      assignee:users!assignee_id(id, name, line_user_id)
    `)
    .gte('completed_at', start.toISOString())
    .lte('completed_at', end.toISOString())
    .eq('status', 'done')
  
  if (error) return res.status(500).json({ error: error.message })
  
  const byDesigner = computePerDesigner(cards || [])
  const overall = computeOverall(cards || [])
  
  res.json({
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    overall,
    byDesigner
  })
}

function parsePeriod(period: string) {
  const [y, m] = period.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0, 23, 59, 59, 999)
  return { start, end }
}

function computePerDesigner(cards) {
  const grouped = new Map()
  for (const c of cards) {
    const a = c.assignee
    if (!a?.line_user_id) continue
    if (!grouped.has(a.id)) grouped.set(a.id, { designer: a, cards: [] })
    grouped.get(a.id).cards.push(c)
  }
  
  return Array.from(grouped.values()).map(g => {
    const cs = g.cards
    const total = cs.length
    
    const onTime = cs.filter(c => 
      c.due_date && c.completed_at && new Date(c.completed_at) <= new Date(c.due_date)
    ).length
    
    const revAvg = total
      ? cs.reduce((s, c) => s + (c.revision_count || 0), 0) / total
      : 0
    
    const brandFits = cs.map(c => c.brand_fit).filter(v => v != null)
    const brandFitScore = brandFits.length
      ? brandFits.reduce((a, b) => a + b, 0) / brandFits.length
      : null
    
    return {
      designer: {
        id: g.designer.id,
        name: g.designer.name,
        lineUserId: g.designer.line_user_id
      },
      cardsCompleted: total,
      onTimeRate: total ? onTime / total : 0,
      revisionAvg: revAvg,
      brandFitScore,
      contentPerformance: null
    }
  })
}

function computeOverall(cards) {
  const total = cards.length
  const designers = new Set(cards.map(c => c.assignee?.id).filter(Boolean))
  const onTime = cards.filter(c =>
    c.due_date && c.completed_at && new Date(c.completed_at) <= new Date(c.due_date)
  ).length
  const totalRev = cards.reduce((s, c) => s + (c.revision_count || 0), 0)
  
  return {
    totalCards: total,
    totalDesigners: designers.size,
    avgRevisionsPerCard: total ? totalRev / total : 0,
    onTimePct: total ? Math.round((onTime / total) * 100) : 0
  }
}
```

### Task 3: Internal auth middleware

```typescript
// lib/internal-auth.ts
export function isInternalCall(req): boolean {
  const key = req.headers['x-internal-key']
  return !!key && key === process.env.INTERNAL_API_KEY
}
```

### Task 4: Env var

```
INTERNAL_API_KEY=<random 32+ char string>
```

Generate: `openssl rand -hex 32` — **ตัวใหม่ ไม่ใช่ key เดียวกับ TechBoard**

**Key management:**
- Key นี้เป็นของ **graphic app เท่านั้น** — ห้าม reuse key ของ TechBoard
- Share **เฉพาะกับ HR team** (set ใน HR's Supabase secrets เป็น `GRAPHIC_INTERNAL_KEY`)
- ห้ามใส่ใน frontend, ห้าม commit เข้า git, ห้ามแชร์ใน LINE/email plain text — ใช้ password manager หรือ hosting env vars เท่านั้น
- ถ้าสงสัยว่าหลุด → rotate ทันที (generate ใหม่ + บอก HR update secret)

---

## Test

```bash
export INTERNAL_API_KEY="<your-key>"

# Local
curl -H "x-internal-key: $INTERNAL_API_KEY" \
  "http://localhost:3000/api/kpi?period=2026-05"

# Production
curl -H "x-internal-key: $INTERNAL_API_KEY" \
  "https://<your-graphic-app>/api/kpi?period=2026-05"

# Test 401
curl "http://localhost:3000/api/kpi?period=2026-05"
```

**Verify:**
- ✓ 200 + valid JSON
- ✓ `byDesigner[].designer.lineUserId` มีค่าทุก entry
- ✓ `periodStart` / `periodEnd` ตรงเดือน
- ✓ `cardsCompleted`, `onTimeRate`, `revisionAvg` คำนวณถูก
- ✓ 401 ถ้าไม่ส่ง header
- ✓ 400 ถ้า period format ผิด

---

## Files affected

```
api/kpi/index.ts                ← new (หรือ pages/api/kpi.ts)
lib/internal-auth.ts            ← new
lib/supabase.ts                 ← existing (Supabase admin client)
supabase/migrations/XXX.sql     ← schema additions (ถ้าจำเป็น)
```

---

## Estimated effort

3-5 ชั่วโมง (schema check + migration + endpoint + test)

---

## Out of scope

- HR app code (อยู่คนละ repo)
- jobMetrics ingestion (HR เป็นคน pull)
- Composite KPI compute
- UI changes (endpoint นี้เป็น machine-to-machine ไม่มี frontend)
