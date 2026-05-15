/**
 * GET /api/kpi-export?period=week|month|quarter|year|all
 *
 * Returns KPI data as CSV (per-designer breakdown) for download.
 * Auth: Supabase bearer token (logged-in user).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { fetchTrelloBoardSnapshot, computeKpi, type PeriodKey } from '@/lib/trello-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const validPeriods: PeriodKey[] = ['week', 'month', 'quarter', 'year', 'all'];
  const periodParam = req.nextUrl.searchParams.get('period') as PeriodKey | null;
  const period: PeriodKey = (periodParam && validPeriods.includes(periodParam)) ? periodParam : 'month';

  try {
    const snap = await fetchTrelloBoardSnapshot();
    const kpi = computeKpi(snap, { period });

    // Build CSV
    const rows: string[] = [];
    rows.push(`TaskFlow KPI Report - ${kpi.period.label}`);
    rows.push(`Generated: ${new Date().toLocaleString('th-TH')}`);
    rows.push(`Board: ${snap.board.name}`);
    rows.push('');
    rows.push('=== ภาพรวม ===');
    rows.push('Metric,Value');
    rows.push(`งานทั้งหมด,${kpi.overall.totalCards}`);
    rows.push(`งานที่ active,${kpi.overall.activeCards}`);
    rows.push(`เสร็จในช่วง,${kpi.overall.completedCards}`);
    rows.push(`เสร็จเดือนนี้,${kpi.overall.completedThisMonth}`);
    rows.push(`เสร็จสัปดาห์นี้,${kpi.overall.completedThisWeek}`);
    rows.push(`On-time rate,${kpi.overall.onTimePct}%`);
    rows.push(`Avg cycle time (วัน),${kpi.overall.avgCycleTimeDays}`);
    rows.push('');
    rows.push('=== Per Designer ===');
    rows.push('Designer,Username,Assigned,Completed,CompletedThisMonth,OnTimeRate,AvgCycleDays');
    for (const d of kpi.byDesigner) {
      rows.push([
        `"${d.name}"`, d.username, d.cardsAssigned, d.cardsCompleted, d.cardsCompletedThisMonth,
        `${Math.round(d.onTimeRate * 100)}%`, d.avgCycleTimeDays.toFixed(1),
      ].join(','));
    }
    rows.push('');
    rows.push('=== Per List ===');
    rows.push('List,Active,Total');
    for (const l of kpi.byList) {
      rows.push(`"${l.name}",${l.activeCount},${l.count}`);
    }
    rows.push('');
    rows.push('=== Bottlenecks (cards stuck > 7 days) ===');
    rows.push('Card,List,DaysStuck,Members,URL');
    for (const b of kpi.bottlenecks) {
      rows.push([
        `"${b.cardName.replace(/"/g, '""')}"`,
        `"${b.listName}"`,
        b.daysStuck,
        `"${b.members.join('; ')}"`,
        b.url || '',
      ].join(','));
    }

    const csv = rows.join('\n');
    const filename = `taskflow-kpi-${kpi.period.key}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'export failed' }, { status: 500 });
  }
}
