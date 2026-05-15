/**
 * GET /api/trello-sync
 *
 * Fetches the Trello board (cached 10 min server-side) and returns computed
 * KPI summary. Used by the in-app Dashboard.
 *
 * Auth: must be logged-in user (we accept Supabase auth bearer header).
 * Add ?force=1 to bypass cache.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { fetchTrelloBoardSnapshot, computeKpi, invalidateTrelloCache, type PeriodKey } from '@/lib/trello-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // Lightweight auth: require any bearer token (Supabase user session)
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  if (force) invalidateTrelloCache();

  const validPeriods: PeriodKey[] = ['week', 'month', 'quarter', 'year', 'all'];
  const periodParam = req.nextUrl.searchParams.get('period') as PeriodKey | null;
  const period: PeriodKey = (periodParam && validPeriods.includes(periodParam)) ? periodParam : 'month';

  try {
    const snap = await fetchTrelloBoardSnapshot();
    const kpi = computeKpi(snap, { period });
    return NextResponse.json({
      ok: true,
      kpi,
      meta: {
        fetchedAt: snap.fetchedAt,
        cacheTtlMin: 10,
        boardName: snap.board.name,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'sync failed' }, { status: 500 });
  }
}
