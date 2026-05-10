'use client';

import { useMemo } from 'react';
import {
  X, TrendingUp, Clock, CheckCircle2, AlertTriangle, Users,
  BarChart3, Timer, Zap, Target, ArrowRight
} from 'lucide-react';
import { useBoardStore } from '@/store/boardStore';
import type { Card, Member } from '@/types';

export default function Dashboard() {
  const { showDashboard, toggleDashboard, boards, activeBoardId } = useBoardStore();
  if (!showDashboard) return null;

  const board = boards.find(b => b.id === activeBoardId);
  if (!board) return null;

  const allCards = board.lists.flatMap(l => l.cards.map(c => ({ ...c, _listTitle: l.title, _listPos: l.position })));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={toggleDashboard} />
      <div className="relative bg-[#1a1d23] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10">
        <div className="sticky top-0 z-10 bg-[#1a1d23] border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">KPI Dashboard</h2>
              <p className="text-xs text-gray-400">{board.title}</p>
            </div>
          </div>
          <button onClick={toggleDashboard} className="p-2 hover:bg-white/10 rounded-lg text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <OverviewCards cards={allCards} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CycleTimeChart cards={allCards} />
            <ThroughputChart cards={allCards} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MemberPerformance cards={allCards} members={board.members} />
            <ListDistribution lists={board.lists} />
          </div>
          <BottleneckAnalysis lists={board.lists} />
        </div>
      </div>
    </div>
  );
}

function OverviewCards({ cards }: { cards: (Card & { _listPos: number })[] }) {
  const stats = useMemo(() => {
    const total = cards.length;
    const completed = cards.filter(c => c.completedAt).length;
    const inProgress = cards.filter(c => !c.completedAt && c._listPos >= 2 && c._listPos <= 5).length;
    const overdue = cards.filter(c => c.dueDate && new Date(c.dueDate) < new Date() && !c.completedAt).length;

    const completedCards = cards.filter(c => c.completedAt);
    const cycleTimes = completedCards.map(c => {
      const created = new Date(c.createdAt).getTime();
      const done = new Date(c.completedAt!).getTime();
      return (done - created) / 86400000;
    });
    const avgCycleTime = cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : 0;

    const last7Days = cards.filter(c => {
      if (!c.completedAt) return false;
      const d = Date.now() - new Date(c.completedAt).getTime();
      return d < 7 * 86400000;
    }).length;

    return { total, completed, inProgress, overdue, avgCycleTime, last7Days };
  }, [cards]);

  const items = [
    { label: 'งานทั้งหมด', value: stats.total, icon: Target, color: 'from-blue-500 to-blue-600', sub: '' },
    { label: 'เสร็จแล้ว', value: stats.completed, icon: CheckCircle2, color: 'from-emerald-500 to-emerald-600', sub: `${stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%` },
    { label: 'กำลังทำ', value: stats.inProgress, icon: Zap, color: 'from-amber-500 to-orange-500', sub: '' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'from-red-500 to-red-600', sub: '' },
    { label: 'เวลาเฉลี่ย/งาน', value: `${stats.avgCycleTime.toFixed(1)}`, icon: Timer, color: 'from-purple-500 to-purple-600', sub: 'วัน' },
    { label: 'เสร็จใน 7 วัน', value: stats.last7Days, icon: TrendingUp, color: 'from-cyan-500 to-teal-500', sub: 'ชิ้น' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(item => (
        <div key={item.label} className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-colors">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center mb-2`}>
            <item.icon size={16} className="text-white" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">{item.value}</span>
            {item.sub && <span className="text-xs text-gray-400">{item.sub}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

function CycleTimeChart({ cards }: { cards: Card[] }) {
  const data = useMemo(() => {
    const completed = cards.filter(c => c.completedAt);
    return completed.map(c => {
      const days = (new Date(c.completedAt!).getTime() - new Date(c.createdAt).getTime()) / 86400000;
      return { title: c.title, days: Math.round(days * 10) / 10 };
    }).sort((a, b) => b.days - a.days).slice(0, 8);
  }, [cards]);

  const maxDays = Math.max(...data.map(d => d.days), 1);

  return (
    <div className="bg-white/5 rounded-xl p-5 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={18} className="text-purple-400" />
        <h3 className="text-sm font-semibold text-white">Cycle Time (วันต่องาน)</h3>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">ยังไม่มีงานที่เสร็จ</p>
      ) : (
        <div className="space-y-2.5">
          {data.map((d, i) => (
            <div key={i} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-300 truncate max-w-[200px]" title={d.title}>{d.title}</span>
                <span className={`text-xs font-mono font-bold ${
                  d.days <= 3 ? 'text-emerald-400' : d.days <= 7 ? 'text-amber-400' : 'text-red-400'
                }`}>{d.days}d</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    d.days <= 3 ? 'bg-emerald-500' : d.days <= 7 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(d.days / maxDays) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-500" />เร็ว (&le;3d)</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-amber-500" />ปกติ (&le;7d)</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-red-500" />ช้า (&gt;7d)</span>
      </div>
    </div>
  );
}

function ThroughputChart({ cards }: { cards: Card[] }) {
  const weeklyData = useMemo(() => {
    const weeks: { label: string; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = Date.now() - (i + 1) * 7 * 86400000;
      const weekEnd = Date.now() - i * 7 * 86400000;
      const count = cards.filter(c => {
        if (!c.completedAt) return false;
        const t = new Date(c.completedAt).getTime();
        return t >= weekStart && t < weekEnd;
      }).length;
      const startDate = new Date(weekStart);
      weeks.push({
        label: `${startDate.getDate()}/${startDate.getMonth() + 1}`,
        count,
      });
    }
    return weeks;
  }, [cards]);

  const maxCount = Math.max(...weeklyData.map(w => w.count), 1);

  return (
    <div className="bg-white/5 rounded-xl p-5 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Throughput (ชิ้น/สัปดาห์)</h3>
      </div>
      <div className="flex items-end gap-3 h-40 px-2">
        {weeklyData.map((w, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-white">{w.count}</span>
            <div className="w-full relative" style={{ height: '120px' }}>
              <div
                className="absolute bottom-0 w-full rounded-t-md bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all hover:from-cyan-500 hover:to-cyan-300"
                style={{ height: `${(w.count / maxCount) * 100}%`, minHeight: w.count > 0 ? '8px' : '2px' }}
              />
            </div>
            <span className="text-xs text-gray-500">w{i + 1}</span>
            <span className="text-[10px] text-gray-600">{w.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 text-center">
        <span className="text-xs text-gray-400">
          เฉลี่ย: <span className="text-cyan-400 font-bold">{(weeklyData.reduce((a, b) => a + b.count, 0) / weeklyData.length).toFixed(1)}</span> ชิ้น/สัปดาห์
        </span>
      </div>
    </div>
  );
}

function MemberPerformance({ cards, members }: { cards: Card[]; members: Member[] }) {
  const data = useMemo(() => {
    return members.map(m => {
      const memberCards = cards.filter(c => c.members.some(cm => cm.id === m.id));
      const completed = memberCards.filter(c => c.completedAt);
      const inProgress = memberCards.filter(c => !c.completedAt);
      const cycleTimes = completed.map(c => {
        return (new Date(c.completedAt!).getTime() - new Date(c.createdAt).getTime()) / 86400000;
      });
      const avgTime = cycleTimes.length > 0 ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0;
      return {
        member: m,
        total: memberCards.length,
        completed: completed.length,
        inProgress: inProgress.length,
        avgTime: Math.round(avgTime * 10) / 10,
      };
    }).sort((a, b) => b.completed - a.completed);
  }, [cards, members]);

  return (
    <div className="bg-white/5 rounded-xl p-5 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} className="text-pink-400" />
        <h3 className="text-sm font-semibold text-white">ผลงานสมาชิก</h3>
      </div>
      <div className="space-y-3">
        {data.map(d => (
          <div key={d.member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: d.member.color }}
            >
              {d.member.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">{d.member.name}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400">{d.completed} เสร็จ</span>
                  <span className="text-amber-400">{d.inProgress} ทำอยู่</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 bg-white/5 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-1.5 rounded-full"
                    style={{ width: d.total > 0 ? `${(d.completed / d.total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 w-14 text-right">
                  avg {d.avgTime}d
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListDistribution({ lists }: { lists: { title: string; cards: Card[]; color?: string }[] }) {
  const total = lists.reduce((a, l) => a + l.cards.length, 0);

  return (
    <div className="bg-white/5 rounded-xl p-5 border border-white/5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={18} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-white">จำนวนงานแต่ละ List</h3>
      </div>
      <div className="space-y-2">
        {lists.filter(l => l.cards.length > 0).map(l => (
          <div key={l.title} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-40 truncate" title={l.title}>{l.title}</span>
            <div className="flex-1 bg-white/5 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${(l.cards.length / Math.max(total, 1)) * 100}%`,
                  backgroundColor: l.color || '#6366f1',
                  minWidth: l.cards.length > 0 ? '12px' : '0',
                }}
              />
            </div>
            <span className="text-xs font-bold text-gray-300 w-6 text-right">{l.cards.length}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5">
        <span className="text-xs text-gray-400">รวม: <span className="text-white font-bold">{total}</span> การ์ด</span>
      </div>
    </div>
  );
}

function BottleneckAnalysis({ lists }: { lists: { title: string; cards: Card[]; position: number }[] }) {
  const bottlenecks = useMemo(() => {
    const workLists = lists.filter(l => l.position >= 2 && l.position <= 5);
    return workLists
      .map(l => {
        const avgAge = l.cards.length > 0
          ? l.cards.reduce((sum, c) => sum + (Date.now() - new Date(c.createdAt).getTime()) / 86400000, 0) / l.cards.length
          : 0;
        return { title: l.title, count: l.cards.length, avgAge: Math.round(avgAge) };
      })
      .filter(l => l.count > 0)
      .sort((a, b) => b.avgAge - a.avgAge);
  }, [lists]);

  if (bottlenecks.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-red-500/5 to-amber-500/5 rounded-xl p-5 border border-red-500/10">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={18} className="text-red-400" />
        <h3 className="text-sm font-semibold text-white">Bottleneck Analysis</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {bottlenecks.map(b => (
          <div key={b.title} className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
              b.avgAge > 10 ? 'bg-red-500' : b.avgAge > 5 ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 truncate">{b.title}</p>
              <p className="text-xs text-gray-500">{b.count} การ์ด • อายุเฉลี่ย {b.avgAge} วัน</p>
            </div>
            {b.avgAge > 7 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 flex-shrink-0">ค้างนาน</span>
            )}
          </div>
        ))}
      </div>
      {bottlenecks.some(b => b.avgAge > 7) && (
        <p className="text-xs text-amber-400/80 mt-3 flex items-center gap-1">
          <Zap size={12} /> แนะนำ: ควรเคลียร์งานที่ค้างนานกว่า 7 วัน หรือกระจายงานให้ทีม
        </p>
      )}
    </div>
  );
}
