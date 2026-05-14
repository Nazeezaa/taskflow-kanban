# TaskFlow Security Posture & Best Practices

> Internal organization use — Krozter team
> Last audit: 2026-05-15

ไฟล์นี้สรุปจุดเสี่ยงที่ต้องระวัง + best practices สำหรับใช้งานในองค์กร

---

## 1. Threat model (ใครอาจเข้ามาทำอะไรได้)

| Actor | สิทธิ์ปัจจุบัน | ที่ควรจะเป็น |
|---|---|---|
| Unauthenticated visitor | เห็นหน้า login เท่านั้น (ผ่าน AuthWrapper) | ✅ ตรงนี้แล้ว |
| Authenticated user | **อ่าน/เขียน/ลบทุก table ของบอร์ดทั้งหมด** (RLS = allow all) | ⚠️ ทุกคนเขียนได้หมด — ต้องตั้ง role |
| HR ผ่าน `/api/kpi` | ส่ง `x-internal-key` header → อ่าน profile + card stats | ✅ ตรง spec |
| External attacker | ต้องผ่าน auth ก่อน | ✅ |
| Anon API caller | โดน 401 ที่ `/api/kpi` + `/api/notify` (ต้องมี CRON_SECRET) | ✅ |

---

## 2. Secrets management

### Env vars ใน Vercel Production
| Var | Sensitivity | ใครเห็น | Rotate ทุก |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 🟢 public | client + server | ไม่ต้อง |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🟡 public (มี RLS guard) | client + server | เมื่อสงสัยว่าหลุด |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔴 **secret** — bypass RLS ทั้งหมด | server only | 90 วัน หรือเมื่อสงสัยว่าหลุด |
| `INTERNAL_API_KEY` | 🔴 **secret** | server only + HR | 90 วัน |
| `CRON_SECRET` | 🔴 **secret** | Vercel cron + server | 90 วัน |
| `LINE_CHANNEL_ACCESS_TOKEN` | 🔴 **secret** | server only | rotate ใน LINE dev console |
| `LINE_CHANNEL_SECRET` | 🔴 **secret** | server only | rotate ใน LINE dev console |

### กฎเหล็ก 🚨
1. **ห้าม commit `.env` / `.env.local`** เข้า git (`.gitignore` ครอบไว้แล้ว — verify)
2. **ห้ามแชร์ service role key** ใน LINE/email plain text — ใช้ Vercel env vars เท่านั้น
3. **ห้าม import `supabaseAdmin` ใน client component** — มี check ใน `src/lib/supabase-admin.ts` ว่าทำงานเฉพาะ server
4. **ห้าม log secret** — ถ้า debug ให้พิมพ์ `[REDACTED]`
5. **ห้าม echo secret ลง response body** — แม้ตอน debug

### Rotation procedure
```bash
# 1. Generate new key
openssl rand -hex 32

# 2. Update Vercel
vercel env rm INTERNAL_API_KEY production
vercel env add INTERNAL_API_KEY production

# 3. Redeploy
vercel --prod

# 4. Notify HR team to update their secret
```

---

## 3. Authentication & Authorization

### Current state
- **Auth**: Supabase Auth (email/password)
- **Session**: JWT token เก็บใน localStorage (Supabase SDK manages)
- **RLS**: เปิดทุก table — **policy ปัจจุบัน = "allow all using (true)"** ⚠️
- **Email confirmation**: ปิด (อนุญาตเข้าใช้ทันทีหลัง signup)

### ⚠️ จุดที่ต้องแก้ก่อน production
1. **Restrict signup ให้เฉพาะ email ในองค์กร**
   ```sql
   -- ตัวอย่าง: only @krozter.com
   create or replace function check_email_domain() returns trigger as $$
   begin
     if new.email not like '%@krozter.com' then
       raise exception 'Email domain not allowed';
     end if;
     return new;
   end;
   $$ language plpgsql security definer;

   create trigger restrict_signup_domain
     before insert on auth.users
     for each row execute function check_email_domain();
   ```

2. **RLS policy ใหม่ (แทน "allow all")**
   ```sql
   -- ตัวอย่าง: ทุก authenticated user เขียน/อ่านได้ — แต่ unauthenticated blocked
   drop policy "allow all" on cards;
   create policy "auth users only" on cards
     for all
     using (auth.role() = 'authenticated')
     with check (auth.role() = 'authenticated');
   -- ทำเช่นเดียวกันกับทุก table
   ```

3. **เพิ่ม role-based access** (ถ้าต้องการ)
   ```sql
   alter table profiles add column role text default 'member' check (role in ('admin','member','viewer'));

   -- viewer อ่านได้แต่เขียนไม่ได้
   create policy "viewer read" on cards for select using (true);
   create policy "member write" on cards for insert
     with check (exists (select 1 from profiles where id = auth.uid() and role != 'viewer'));
   ```

---

## 4. Data exposure risks

### ที่ฝั่ง client (browser) เห็น
- ✅ Supabase URL + anon key (ไม่ใช่ secret — แต่ใช้กับ RLS guard)
- ✅ Profile ของ user ทุกคน (name, email, avatar, online status) — เพื่อ assign member
- ❌ ห้ามส่ง: service role key, internal API key, password hash, raw auth tokens ของคนอื่น

### Storage bucket `card-covers`
- ปัจจุบัน: **public bucket** — ใครก็ตามที่รู้ URL จะเปิดได้
- ⚠️ ถ้าจะใส่รูปลับ (ใบเสนอราคา, สลิป) ต้องเปลี่ยนเป็น private + use signed URLs
- ตัวอย่าง:
  ```typescript
  const { data } = await supabase.storage.from('card-covers')
    .createSignedUrl(path, 3600);  // ใช้ได้ 1 ชั่วโมง
  ```

---

## 5. API endpoint security

### `/api/kpi` (HR pull)
- ✅ Auth via `x-internal-key` header
- ✅ Constant-time compare (`isInternalCall`)
- ✅ ตรวจ format ของ `period` ก่อน query → กัน injection
- ✅ ใช้ `supabaseAdmin` (service-role) → bypass RLS แต่ endpoint นี้ trusted
- ⚠️ ไม่มี rate limit — แนะนำใช้ Vercel WAF หรือ middleware

### `/api/line/webhook`
- ✅ Validate `x-line-signature` ด้วย HMAC SHA256
- ⚠️ ตรวจสอบว่า `LINE_CHANNEL_SECRET` ตั้งจริงใน env (ถ้าไม่ตั้ง = bypass)

### `/api/notify` (cron)
- ✅ Auth via `Authorization: Bearer ${CRON_SECRET}`
- ⚠️ ถ้า CRON_SECRET ไม่ตั้ง = blocked

---

## 6. Input validation gaps

### ที่ต้องเพิ่ม
- [ ] Card title: max length (currently unlimited)
- [ ] Description: max 50KB
- [ ] Comment: max 5KB + sanitize HTML (กัน XSS ถ้าจะ render markdown)
- [ ] Attachment: max file size + allowed MIME types (ตอนนี้รับทุกอย่าง)
- [ ] Image upload: scan virus / strip EXIF
- [ ] URL fields (cover_image, attachment.url): allowlist domain

### XSS risk
- ตอนนี้ description / comment render เป็น plain text → ปลอดภัย
- ถ้าจะเพิ่ม markdown render: ใช้ `react-markdown` + `rehype-sanitize`
- **ห้ามใช้ `dangerouslySetInnerHTML`** กับ user content

---

## 7. Audit log

- ✅ Activity table log การ move/complete card
- ❌ ไม่ log: login, sign-up, delete, archive, change permission
- ❌ ไม่ log: ใครเข้า `/api/kpi` ตอนไหน

### แนะนำ
```sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,        -- 'login', 'card.delete', 'kpi.fetch', ...
  resource_type text,
  resource_id text,
  ip text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz default now()
);
create index idx_audit_actor on audit_log(actor_id, created_at desc);
create index idx_audit_action on audit_log(action, created_at desc);
```

---

## 8. Backup & disaster recovery

- ✅ Supabase Free tier: daily backup (retention 7 วัน)
- ⚠️ ถ้าทีมขยาย → upgrade Pro plan (point-in-time recovery)
- 📥 **Manual backup**: ทุกสัปดาห์รัน:
  ```bash
  supabase db dump --db-url "$DB_URL" > backup-$(date +%Y%m%d).sql
  ```
- ☁️ เก็บ dump ที่ external (Google Drive ของ team)

---

## 9. Incident response

ถ้าสงสัยว่า secret หลุด:
1. **Rotate** key ทันที (ดูข้อ 2)
2. **Audit log**: เช็คใน Supabase Logs ว่ามี query แปลกๆ ไหม
3. **Sign out ทุก user**: `update auth.users set ...` หรือ Supabase dashboard → invalidate sessions
4. **แจ้งทีม**: เปลี่ยน password ทุกคน
5. **Post-mortem**: เขียนว่าหลุดยังไง + ป้องกันยังไง

---

## 10. Pre-launch security checklist

- [ ] รัน `npm audit` — แก้ vulnerability สูง/วิกฤต
- [ ] เปลี่ยน RLS policy จาก "allow all" → "auth users only" (ข้อ 3)
- [ ] Restrict signup ให้เฉพาะ email ของบริษัท
- [ ] ตั้ง Vercel WAF / rate limit basic
- [ ] เปิด HTTPS only (default บน Vercel)
- [ ] เปิด HSTS header (Next.js config)
- [ ] เพิ่ม Content-Security-Policy header
- [ ] Audit log table + log critical actions
- [ ] Private storage bucket (ถ้ามีไฟล์ลับ)
- [ ] Document procedure for offboarding (ลบ profile + revoke access)
- [ ] Test backup restore process

---

## Quick reference — กฎ 5 ข้อสำหรับทีม dev

1. 🚫 **ห้าม commit secret** — ถ้าหลุดต้อง rotate ทันที + `git filter-repo` ลบ history
2. 🔒 **Service role key = server only** — import ในไฟล์ที่อยู่ใน `src/app/api/**` หรือ `src/lib/supabase-admin.ts` เท่านั้น
3. 🛡️ **RLS เปิดเสมอ** — ถึงจะใช้ "allow all" ก็ต้องเปิด เพื่อ defense in depth
4. ✅ **Validate input ทุก endpoint** — ก่อนยิงเข้า DB
5. 📝 **Log สิ่งสำคัญ** — login, delete, permission change

---

## ติดต่อ

ถ้าพบจุดเสี่ยง / suspicious activity → แจ้ง team lead ทันที + ปิด deploy ที่กระทบไว้ก่อน
