/**
 * GET /api/kpi?period=YYYY-MM
 *
 * Returns per-designer KPI metrics for HR pull (machine-to-machine).
 * Auth via x-internal-key header → INTERNAL_API_KEY env var.
 *
 * Spec: INTEGRATION-graphic.md
 *
 * REPO ↔ SPEC field mapping:
 *   spec.users               → repo.profiles      (auth-based users table)
 *   spec.users.line_user_id  → repo.profiles.line_user_id  (added by migration)
 *   spec.cards.status='done' → repo.cards.completed_at IS NOT NULL
 *                              (completed_at is set automatically when card is moved
 *                               to a list whose title contains "เสร็จ" or "โพส" —
 *                               see src/lib/db.ts dbMoveCard)
 *   spec.cards.assignee_id   → repo.card_members (M:N join table, member_id = profile.id)
 *                              A card with multiple members is counted once per designer.
 *   spec.cards.revision_count → repo.cards.revision_count (added by migration)
 *   spec.cards.brand_fit      → repo.cards.brand_fit (added by migration, 0-10 nullable)
 *
 * Edge cases handled:
 *   - card with no assignee (no entry in card_members) → not counted
 *   - designer without line_user_id → skipped with console.warn
 *   - card with completed_at = null → not counted (even if in "done" list)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { isInternalCall } from '@/lib/internal-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type KpiCard = {
  id: string;
  completed_at: string;
  due_date: string | null;
  revision_count: number | null;
  brand_fit: number | null;
};

type Designer = {
  id: string;
  name: string;
  line_user_id: string | null;
};

type DesignerKpi = {
  designer: { id: string; name: string; lineUserId: string };
  cardsCompleted: number;
  onTimeRate: number;
  revisionAvg: number;
  brandFitScore: number | null;
  contentPerformance: null;
};

export async function GET(req: NextRequest) {
  if (!isInternalCall(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const period = req.nextUrl.searchParams.get('period') || '';
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 });
  }

  const { start, end } = parsePeriod(period);
  const supa = supabaseAdmin();

  // ────────────────────────────────────────────────────────────────────
  // Pull completed cards in period
  // (status='done' in spec → completed_at IS NOT NULL in repo)
  // ────────────────────────────────────────────────────────────────────
  const { data: cards, error: cardsErr } = await supa
    .from('cards')
    .select('id, completed_at, due_date, revision_count, brand_fit')
    .gte('completed_at', start.toISOString())
    .lte('completed_at', end.toISOString())
    .not('completed_at', 'is', null);

  if (cardsErr) {
    return NextResponse.json({ error: cardsErr.message }, { status: 500 });
  }

  const cardList = (cards || []) as KpiCard[];

  // ────────────────────────────────────────────────────────────────────
  // Pull card_members join (spec's assignee_id is M:N in repo)
  // ────────────────────────────────────────────────────────────────────
  const cardIds = cardList.map((c) => c.id);
  let assignments: { card_id: string; member_id: string }[] = [];
  if (cardIds.length) {
    const { data: cm, error: cmErr } = await supa
      .from('card_members')
      .select('card_id, member_id')
      .in('card_id', cardIds);
    if (cmErr) return NextResponse.json({ error: cmErr.message }, { status: 500 });
    assignments = cm || [];
  }

  // ────────────────────────────────────────────────────────────────────
  // Pull designer profiles
  // ────────────────────────────────────────────────────────────────────
  const memberIds = Array.from(new Set(assignments.map((a) => a.member_id)));
  let profiles: Designer[] = [];
  if (memberIds.length) {
    const { data: pf, error: pfErr } = await supa
      .from('profiles')
      .select('id, name, line_user_id')
      .in('id', memberIds);
    if (pfErr) return NextResponse.json({ error: pfErr.message }, { status: 500 });
    profiles = (pf || []) as Designer[];
  }

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // ────────────────────────────────────────────────────────────────────
  // Normalize → spec response shape
  // ────────────────────────────────────────────────────────────────────
  const byDesigner = computePerDesigner(cardList, assignments, profileById);
  const overall = computeOverall(cardList, assignments, profileById);

  return NextResponse.json({
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    overall,
    byDesigner,
  });
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function parsePeriod(period: string): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number);
  // Asia/Bangkok = UTC+7. Build start/end in Bangkok then convert to UTC.
  // start = 1st of month 00:00:00 +07:00 → UTC = previous day 17:00
  const startBkk = `${y}-${String(m).padStart(2, '0')}-01T00:00:00+07:00`;
  const endDay = new Date(y, m, 0).getDate(); // last day of month
  const endBkk = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}T23:59:59+07:00`;
  return { start: new Date(startBkk), end: new Date(endBkk) };
}

function computePerDesigner(
  cards: KpiCard[],
  assignments: { card_id: string; member_id: string }[],
  profileById: Map<string, Designer>
): DesignerKpi[] {
  const cardById = new Map(cards.map((c) => [c.id, c]));

  // Group cards by designer (member_id)
  const byMember = new Map<string, KpiCard[]>();
  for (const a of assignments) {
    const card = cardById.get(a.card_id);
    if (!card) continue;
    if (!byMember.has(a.member_id)) byMember.set(a.member_id, []);
    byMember.get(a.member_id)!.push(card);
  }

  const result: DesignerKpi[] = [];
  for (const [memberId, cs] of byMember) {
    const profile = profileById.get(memberId);
    if (!profile) continue; // member_id has no matching profile → skip

    // Edge case: designer without line_user_id → skip + warn
    if (!profile.line_user_id) {
      console.warn(`[kpi] designer ${profile.id} (${profile.name}) has no line_user_id — skipped`);
      continue;
    }

    const total = cs.length;
    const onTime = cs.filter(
      (c) => c.due_date && c.completed_at && new Date(c.completed_at) <= new Date(c.due_date)
    ).length;

    const revAvg = total
      ? cs.reduce((s, c) => s + (c.revision_count ?? 0), 0) / total
      : 0;

    const brandFits = cs.map((c) => c.brand_fit).filter((v): v is number => v != null);
    const brandFitScore = brandFits.length
      ? brandFits.reduce((a, b) => a + b, 0) / brandFits.length
      : null;

    result.push({
      designer: {
        id: profile.id,
        name: profile.name,
        lineUserId: profile.line_user_id,
      },
      cardsCompleted: total,
      onTimeRate: total ? round(onTime / total, 4) : 0,
      revisionAvg: round(revAvg, 2),
      brandFitScore: brandFitScore != null ? round(brandFitScore, 1) : null,
      contentPerformance: null, // out of scope per spec
    });
  }

  // Stable order: by cardsCompleted desc
  result.sort((a, b) => b.cardsCompleted - a.cardsCompleted);
  return result;
}

function computeOverall(
  cards: KpiCard[],
  assignments: { card_id: string; member_id: string }[],
  profileById: Map<string, Designer>
) {
  // Only count cards that have at least one assignee with a line_user_id (matches byDesigner scope)
  const validMemberIds = new Set(
    Array.from(profileById.values())
      .filter((p) => p.line_user_id)
      .map((p) => p.id)
  );
  const cardsWithValidAssignee = new Set(
    assignments.filter((a) => validMemberIds.has(a.member_id)).map((a) => a.card_id)
  );
  const scopedCards = cards.filter((c) => cardsWithValidAssignee.has(c.id));

  const total = scopedCards.length;
  const designers = new Set(
    assignments
      .filter((a) => validMemberIds.has(a.member_id) && cardsWithValidAssignee.has(a.card_id))
      .map((a) => a.member_id)
  );
  const onTime = scopedCards.filter(
    (c) => c.due_date && c.completed_at && new Date(c.completed_at) <= new Date(c.due_date)
  ).length;
  const totalRev = scopedCards.reduce((s, c) => s + (c.revision_count ?? 0), 0);

  return {
    totalCards: total,
    totalDesigners: designers.size,
    avgRevisionsPerCard: total ? round(totalRev / total, 2) : 0,
    onTimePct: total ? Math.round((onTime / total) * 100) : 0,
  };
}

function round(n: number, decimals: number): number {
  const m = Math.pow(10, decimals);
  return Math.round(n * m) / m;
}
