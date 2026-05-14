# TaskFlow Roadmap

> Kanban app สำหรับทีม Content Marketing ของ Krozter
> Last updated: 2026-05-15

---

## Status Legend
- ✅ Production-ready
- 🟡 ใช้งานได้แต่ยังขัดเกลา
- 🔴 ยังไม่มี / ค้างอยู่
- 🧪 อยู่ในขั้น test

---

## v0.1 — MVP (เสร็จแล้ว) ✅

### Core Kanban
| Feature | Status | Note |
|---|---|---|
| 10 lists ตาม Trello workflow | ✅ | Plan → Fast Lane → ปั่นงาน → QC → ... → โพสแล้ว |
| Add/Edit/Delete card | ✅ | optimistic update |
| Drag & drop card (ใน list + ข้าม list) | ✅ | @dnd-kit |
| Labels (ด่วน/กำลังทำ/ออกแบบ/...) | ✅ | 6 default labels |
| Members (assign) | ✅ | ดึงจาก profiles ของ user จริง |
| Due date + start date | ✅ | + overdue indicator |
| Cover image + cover color | ✅ | upload ขึ้น Supabase Storage |
| Attachments | ✅ | file upload + preview + set as cover |
| Checklists | ✅ | create / item / toggle / delete |
| Comments + รูปใน comment | ✅ | + edit / delete |
| Activity log | ✅ | logged ทุก move/complete |
| Archive card | ✅ | soft delete (`archived = true`) |
| Copy card | ✅ | clone ทุก field |
| Watch card | ✅ | toggle eye |

### Auth & Multi-user
| Feature | Status | Note |
|---|---|---|
| Email/password sign up + sign in | ✅ | Supabase Auth |
| Profile auto-create on signup | ✅ | trigger `handle_new_user()` |
| Online presence (จุดเขียวบน avatar) | ✅ | Supabase Realtime Presence |
| Realtime sync ระหว่าง user | ✅ | postgres_changes ทุก table |
| Sign out | ✅ | Header menu |

### Integrations
| Feature | Status | Note |
|---|---|---|
| LINE Bot webhook (`/api/line/webhook`) | ✅ | คำสั่ง: สรุป, เพิ่ม, deadline, help |
| LINE push notification (`/api/notify`) | ✅ | deadline / daily summary |
| KPI endpoint (`/api/kpi`) for HR | ✅ | spec ตาม `INTEGRATION-graphic.md` |
| PWA (installable + offline cache) | ✅ | manifest + service worker |
| Web Push notification (browser) | 🟡 | permission API ทำแล้ว, ยังไม่ wire payload backend |
| Vercel cron (daily 9am summary) | ✅ | `vercel.json` |

### Views
| Feature | Status | Note |
|---|---|---|
| Board view | ✅ | |
| Calendar view (monthly) | 🟡 | view-only, ยังลากเลื่อน due date ไม่ได้ |
| Activity feed sidebar | ✅ | |
| Dashboard / KPI | 🟡 | UI สวยแล้ว แต่ chart ยังเป็น mock บางส่วน |
| AI Assistant chat | 🟡 | local response generator, ยังไม่ต่อ LLM จริง |

---

## v0.2 — Polish & Stability (ทำต่อไป) 🟡

### P0 — Critical (ทำก่อน)
1. **Audit ฟังก์ชันทุกอย่างให้ทำงานจริงไม่พัง** — เพิ่งแก้ infinite loading bug, ต้องเทสทุก flow
2. **รัน migration SQL** (`supabase/migrations/2026-05-15-kpi-integration.sql`)
3. **Web Push backend** — wire `/api/notify` ให้ส่งจริงไป browser
4. **Form validation** — `addCard` ห้าม submit ว่าง, dueDate ห้ามอยู่ในอดีต (warn)
5. **Error toast** — แทนที่ `alert()` / silent fail ทุกตัว

### P1 — UX gaps
6. **Drag card ใน Calendar view** เพื่อ reschedule due_date
7. **Bulk operations** — select หลายการ์ด → archive/move ทีเดียว
8. **Keyboard shortcuts**: `N` = new card, `/` = search, `Esc` = close modal
9. **Markdown rendering ใน description** (ตอนนี้ raw text)
10. **Reactions บน comment** (❤️ 👍 😂)
11. **@mentions ใน comment** → notify member
12. **Filter cards** — by label/member/due

### P2 — Nice to have
13. **Card templates** — UI ทำแล้ว แต่ทำให้ list ของ templates แก้ได้
14. **Reorder checklists / items** (drag)
15. **Reorder lists** (drag horizontally)
16. **Sort list menu** — by date / member / label
17. **Card timeline / Gantt view**
18. **Custom labels** — ให้ user สร้าง label ของตัวเองได้

---

## v0.3 — Advanced (ถ้าทีมใช้จริงแล้วยังอยากต่อ) 🔴

| Feature | Effort | Note |
|---|---|---|
| AI assistant ต่อ LLM (Claude/OpenAI) | M | ส่งบอร์ดทั้งหมดเป็น context → ตอบสรุปได้จริง |
| Workspace / multiple boards | L | ตอนนี้ hardcode board 1 ตัว |
| Roles & permissions (admin / member / viewer) | L | RLS policies + middleware |
| Card dependencies (blocks / blocked by) | M | new table `card_links` |
| Butler-style automation (rule engine) | L | DB-driven rules — UI ทำแล้ว แต่ engine ยังไม่ run |
| Public share link (read-only) | M | random token URL |
| Export to CSV / Excel | S | reuse existing query |
| Email digest weekly | S | new cron + email service (Resend/SendGrid) |

---

## v0.4 — Native (ถ้าจริงๆแล้ว PWA ไม่พอ)
- iOS/Android wrapper ผ่าน Capacitor
- App Store ($99/yr) + Google Play ($25 one-time)
- Effort: M (~1 สัปดาห์)

---

## Tech debt / Known issues 🐛

1. **Mock members table ยังอยู่** — schema มี `members` table เก่า + `card_members.member_id` ตอนนี้อ้างไป `profiles.id` (FK ถูก drop) — ควร migrate ให้สะอาด
2. **AI assistant ยังเป็น local stub** — ไม่ได้ใช้ LLM จริง
3. **Realtime subscription ไม่มี cleanup** — อาจ leak channel ถ้าเปลี่ยน board หลายครั้ง
4. **ไม่มี error boundary** — uncaught error อาจทำให้ทั้ง app ตาย
5. **Service worker cache** — เคยทำให้ user ค้าง loading; ตอนนี้ auto-unregister แต่ยังไม่ได้เปิด SW ใหม่กลับ
6. **Comment image ใช้ data URL** — ไม่ได้อัพขึ้น storage → ทำให้ DB ใหญ่ถ้ารูปเยอะ

---

## ลำดับงานแนะนำ (next 1-2 weeks)

```
สัปดาห์ 1:
  จันทร์-อังคาร  → P0 #1, #2 (audit + migration)
  พุธ-พฤหัส      → P0 #3, #4 (web push + validation)
  ศุกร์          → P0 #5 (error toast)

สัปดาห์ 2:
  จันทร์-อังคาร  → P1 #6, #7 (calendar drag + bulk)
  พุธ-พฤหัส      → P1 #8, #9, #10 (shortcuts + markdown + reactions)
  ศุกร์          → ทดสอบ + deploy
```

---

## Definition of Done (สำหรับฟีเจอร์ใหม่ทุกตัว)

- [ ] Code ผ่าน `next build` ไม่มี TS error
- [ ] Manual test 3 cases: happy / sad / empty
- [ ] Mobile + desktop view ดูได้
- [ ] Realtime sync ทำงาน (อย่างน้อย 2 tab)
- [ ] Error case มี toast / log ไม่ silent
- [ ] Commit message ระบุชัด feature + why

---

## Out of scope (ตัด)

- Card timeline/Gantt (v0.3+)
- Mobile native (v0.4+)
- Workspace switching (มี board เดียวพอ)
- Power-Ups marketplace (ตัด — Trello pro feature)
- Voice chat / video call

ปรับ scope ได้ตามที่ทีมใช้จริง — ฟีเจอร์ไหนไม่ได้แตะ 2 สัปดาห์ติด = ตัดได้
