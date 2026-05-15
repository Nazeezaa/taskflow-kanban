/**
 * GET /api/cron/daily-summary
 *
 * Triggered by Vercel cron at 09:00 Asia/Bangkok daily.
 * Pulls fresh Trello data and posts a formatted summary to LINE group.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 * Env required: CRON_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_GROUP_ID
 */

import { NextResponse, type NextRequest } from 'next/server';
import { fetchTrelloBoardSnapshot, computeKpi, invalidateTrelloCache } from '@/lib/trello-api';
import { pushMessage, textMessage } from '@/lib/line';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer ${CRON_SECRET}
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const groupId = process.env.LINE_GROUP_ID;
  if (!groupId) {
    return NextResponse.json({
      error: 'LINE_GROUP_ID not set — add it in Vercel env to enable',
      hint: 'Get group id by having the bot join a group, then check webhook logs',
    }, { status: 500 });
  }

  try {
    invalidateTrelloCache(); // always fresh for daily summary
    const snap = await fetchTrelloBoardSnapshot();
    const kpiWeek = computeKpi(snap, { period: 'week' });
    const kpiMonth = computeKpi(snap, { period: 'month' });

    const yesterdayCompleted = countCompletedYesterday(snap);

    const top = kpiWeek.byDesigner[0];
    const topMsg = top
      ? `🏆 ทำเยอะสุดสัปดาห์นี้: ${top.name} (${top.cardsCompleted} ใบ)`
      : '';

    const bottleneckMsg = kpiWeek.bottlenecks.length > 0
      ? `⚠️ งานค้าง > 7 วัน: ${kpiWeek.bottlenecks.length} ใบ (เช่น "${kpiWeek.bottlenecks[0].cardName.slice(0, 30)}...")`
      : '';

    const onTimeIcon = kpiWeek.overall.onTimePct >= 80 ? '🎯' : kpiWeek.overall.onTimePct >= 60 ? '👍' : '⚠️';
    const dateStr = new Date().toLocaleDateString('th-TH', {
      weekday: 'long', day: 'numeric', month: 'short',
    });

    const lines = [
      `☀️ สรุปงานประจำวัน · ${dateStr}`,
      '',
      `✅ เมื่อวานเสร็จ ${yesterdayCompleted} ใบ`,
      `📊 สัปดาห์นี้รวม ${kpiWeek.overall.completedCards} ใบ (${kpiMonth.overall.completedCards} เดือนนี้)`,
      `⏱️ Cycle เฉลี่ย ${kpiWeek.overall.avgCycleTimeDays} วัน`,
      `${onTimeIcon} On-time ${kpiWeek.overall.onTimePct}%`,
    ];
    if (topMsg) lines.push('', topMsg);
    if (bottleneckMsg) lines.push(bottleneckMsg);
    lines.push('', `📈 ดู dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'https://taskflow-kanban-rho.vercel.app'}`);

    const text = lines.join('\n');

    await pushMessage(groupId, [textMessage(text)]);

    return NextResponse.json({
      ok: true,
      sent: { to: groupId.slice(0, 8) + '…', length: text.length },
      preview: text,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'failed' }, { status: 500 });
  }
}

function countCompletedYesterday(snap: any): number {
  const now = new Date();
  const yStart = new Date(now);
  yStart.setDate(now.getDate() - 1);
  yStart.setHours(0, 0, 0, 0);
  const yEnd = new Date(yStart);
  yEnd.setHours(23, 59, 59, 999);

  // Re-use logic by checking actions
  const doneListIds = new Set(
    snap.lists
      .filter((l: any) => /เสร็จ|โพส|done|complete/i.test(l.name))
      .map((l: any) => l.id)
  );
  let count = 0;
  const counted = new Set<string>();
  for (const a of snap.actions) {
    if (a.type !== 'updateCard' || !a.data?.listAfter) continue;
    if (!doneListIds.has(a.data.listAfter.id)) continue;
    const t = new Date(a.date).getTime();
    if (t >= yStart.getTime() && t <= yEnd.getTime()) {
      const cid = a.data.card?.id;
      if (cid && !counted.has(cid)) {
        counted.add(cid);
        count++;
      }
    }
  }
  return count;
}
