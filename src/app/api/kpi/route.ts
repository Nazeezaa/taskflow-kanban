/**
 * GET /api/kpi?period=YYYY-MM
 *
 * KPI endpoint for HR pull. Data source is now Trello (via TRELLO_API_KEY+TOKEN).
 * TaskFlow no longer stores the kanban data — Trello is source of truth.
 *
 * Designer.lineUserId comes from Supabase `profiles` table (mapped by username or display name).
 *
 * Spec: INTEGRATION-graphic.md
 * Auth: x-internal-key header
 *
 * REPO ↔ SPEC field mapping:
 *   spec.users               → trello board members + supabase profiles (line_user_id)
 *   spec.cards.status='done' → trello card moved to list whose name contains
 *                              "เสร็จ" / "โพส" / "done" / "complete" (see trello-api.ts isDoneList)
 *   spec.cards.assignee_id   → trello card.idMembers (M:N, counted per designer)
 *   spec.cards.revision_count → NOT tracked in Trello (returns 0)
 *   spec.cards.brand_fit      → NOT tracked in Trello (returns null)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { isInternalCall } from '@/lib/internal-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchTrelloBoardSnapshot, computeHrKpi } from '@/lib/trello-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isInternalCall(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const period = req.nextUrl.searchParams.get('period') || '';
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 });
  }

  const { start, end } = parsePeriod(period);

  try {
    // 1. Pull Trello snapshot (cached 10 min)
    const snap = await fetchTrelloBoardSnapshot();

    // 2. Pull line_user_id mapping from Supabase profiles
    //    (key by both username for trello lookup and id)
    const supa = supabaseAdmin();
    const { data: profiles } = await supa
      .from('profiles')
      .select('id, name, email, line_user_id')
      .not('line_user_id', 'is', null);

    const lineUserIdMap = new Map<string, string>();
    for (const p of profiles || []) {
      if (!p.line_user_id) continue;
      // Map by name (case-insensitive); HR/admin can adjust manually if needed
      lineUserIdMap.set(p.name.toLowerCase(), p.line_user_id);
      // Also try email username part
      const emailUser = p.email?.split('@')[0]?.toLowerCase();
      if (emailUser) lineUserIdMap.set(emailUser, p.line_user_id);
    }

    // 3. Compute KPI in period
    //    Map Trello username/name → line_user_id via profiles
    //    For each Trello member, look up by lowercased name or username
    const trelloLineMap = new Map<string, string>();
    for (const m of snap.members) {
      const byUsername = lineUserIdMap.get(m.username.toLowerCase());
      const byName = lineUserIdMap.get(m.fullName.toLowerCase());
      const found = byUsername || byName;
      if (found) {
        trelloLineMap.set(m.username, found);
        trelloLineMap.set(m.id, found);
      }
    }

    const kpi = computeHrKpi(snap, { start, end }, trelloLineMap);

    return NextResponse.json({
      period,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      overall: kpi.overall,
      byDesigner: kpi.byDesigner,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'kpi failed' }, { status: 500 });
  }
}

function parsePeriod(period: string): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number);
  const startBkk = `${y}-${String(m).padStart(2, '0')}-01T00:00:00+07:00`;
  const endDay = new Date(y, m, 0).getDate();
  const endBkk = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}T23:59:59+07:00`;
  return { start: new Date(startBkk), end: new Date(endBkk) };
}
