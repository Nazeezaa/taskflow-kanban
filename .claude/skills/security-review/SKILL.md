---
name: security-review
description: Run a security review of the TaskFlow Kanban app. Use this skill whenever the user asks "ตรวจความปลอดภัย", "review security", "เช็ค secret", "audit RLS", "scan for vulnerabilities", or before any production deploy. Reads SECURITY.md as authoritative checklist and produces a prioritized findings report.
---

# Security Review — TaskFlow Kanban

When this skill runs, do the following — in order — and produce a findings report.

## 1. Scope check

Before scanning, confirm what to review:
- 🔍 Full codebase audit (default)
- 🔍 Just changed files since last commit (if user says "review my changes")
- 🔍 Just a specific area (auth / API / DB / secrets)

Read `SECURITY.md` at repo root — it contains the org's threat model and rules. Use it as authoritative.

## 2. Automated checks (run these in parallel where possible)

### Secrets in code
```bash
# Hard-coded secrets in source
grep -rIn -E "(sb_secret_|service_role|sk_live_|sk_test_|sb_publishable_|eyJ[A-Za-z0-9_-]{40,})" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  . || echo "✓ no hardcoded secrets"

# .env files committed?
git ls-files | grep -E "^\.env(\.|$)" && echo "❌ .env tracked!" || echo "✓ no .env in git"

# Recent commit history for secret leaks
git log --all -p -S "sb_secret_" -S "service_role" -S "sk_live_" --oneline | head -20
```

### Client-side admin client import (NEVER allowed)
```bash
grep -rIn "supabaseAdmin\|SUPABASE_SERVICE_ROLE_KEY" \
  --include="*.ts" --include="*.tsx" \
  src/components/ src/app/ 2>/dev/null \
  | grep -v "src/app/api/" \
  | grep -v "src/lib/supabase-admin.ts" \
  && echo "❌ admin client used in non-API code" \
  || echo "✓ admin client confined to server"
```

### Dangerous patterns
```bash
# Unsafe HTML
grep -rIn "dangerouslySetInnerHTML" src/ --include="*.tsx" \
  | grep -v "manifest\|sw\.js registration"  # skip known-safe usages

# eval / Function constructor
grep -rIn -E "\beval\(|new Function\(" src/ --include="*.ts" --include="*.tsx"

# Disabled cert verification
grep -rIn "rejectUnauthorized: false\|NODE_TLS_REJECT_UNAUTHORIZED" src/
```

### Dependency vulnerabilities
```bash
npm audit --audit-level=moderate 2>&1 | tail -30
```

### RLS posture
Query Supabase (via SQL editor or psql) to verify every table has RLS enabled:
```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;
```
Flag any `rowsecurity = false`.

### Public storage buckets
Check Supabase Storage:
```sql
select id, name, public from storage.buckets;
```
For each `public = true`, ask: should this be private + signed URLs?

## 3. Manual review checklist

For each new/changed file, evaluate against `SECURITY.md` ข้อ 6 (Input validation) and ข้อ 4 (Data exposure):

- [ ] All API routes verify auth before any DB action
- [ ] All API routes validate input shape + length before query
- [ ] User content rendered as plain text (no `dangerouslySetInnerHTML`)
- [ ] File uploads check MIME + size before storage
- [ ] No secret in error response body (no `error.message` leak when sensitive)
- [ ] No PII in logs
- [ ] Realtime channels don't expose other users' private data

## 4. Output format

Produce a report with this exact structure:

```
# Security Review Report — <date>

## Summary
- Findings: <P0 / P1 / P2 counts>
- Recommendation: <ship / block / ship with caveats>

## Findings

### P0 (block deploy)
- [<finding>] <file:line>
  Risk: <what could happen>
  Fix: <how to fix in 1-2 lines>

### P1 (fix soon)
...

### P2 (nice to have)
...

## Verified ✓
- <list of things explicitly checked and OK>

## Untested / out of scope
- <things this run did NOT check>
```

## 5. Severity rubric

| Level | Meaning | Examples |
|---|---|---|
| P0 | Block deploy — exploitable now | Hardcoded service-role key, SQL injection, auth bypass, secret in git |
| P1 | Fix this sprint — exploitable with effort | RLS disabled on table, public bucket with sensitive data, missing input validation, no rate limit on auth endpoint |
| P2 | Hygiene / defense-in-depth | Missing audit log, dependency 1 minor version behind, weaker password policy |

## 6. Do NOT

- Don't propose breaking changes without an explicit migration plan
- Don't run `git filter-repo` or rewrite history — propose it, let the user execute
- Don't expose any secret value in your report — say `<redacted>` or just file:line reference
- Don't auto-fix anything without confirming with user first (security fixes can break things)

## 7. After the report

If user accepts findings, proceed to fix them one by one with their approval. After each fix:
1. Re-run the relevant check from §2
2. Note in commit: `security: fix <finding>` + reference to SECURITY.md section
