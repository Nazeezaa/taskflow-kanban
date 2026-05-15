'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LayoutGrid, TrendingUp, Clock, Users, Tag, RefreshCw, LogOut, ExternalLink,
  CheckCircle2, AlertCircle, Activity, Calendar, AlertTriangle, Download,
} from 'lucide-react';
import { useBoardStore } from '@/store/boardStore';
import { signOut } from '@/lib/auth';

type PeriodKey = 'week' | 'month' | 'quarter' | 'year' | 'all';

interface KpiData {
  fetchedAt: string;
  period: { key: PeriodKey; label: string; start: string; end: string };
  overall: {
    totalCards: number;
    activeCards: number;
    completedCards: number;
    completedThisMonth: number;
    completedThisWeek: number;
    onTimeRate: number;
    onTimePct: number;
    avgCycleTimeDays: number;
  };
  byDesigner: {
    id: string; name: string; username: string;
    cardsAssigned: number; cardsCompleted: number; cardsCompletedThisMonth: number;
    onTimeRate: number; avgCycleTimeDays: number;
  }[];
  byList: { id: string; name: string; count: number; activeCount: number }[];
  byLabel: { id: string; name: string; color: string; count: number }[];
  throughput: { weekStart: string; completed: number }[];
  bottlenecks: {
    cardId: string; cardName: string; listName: string;
    daysStuck: number; members: string[]; url?: string;
  }[];
}

const COLOR_TO_HEX: Record<string, string> = {
  green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444',
  purple: '#a855f7', blue: '#3b82f6', sky: '#06b6d4', lime: '#84cc16',
  pink: '#ec4899', black: '#374151', gray: '#6b7280',
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'week', label: 'สัปดาห์นี้' },
  { key: 'month', label: 'เดือนนี้' },
  { key: 'quarter', label: '3 เดือน' },
  { key: 'year', label: '1 ปี' },
  { key: 'all', label: 'ทั้งหมด' },
];

export default function TrelloDashboard() {
  const { currentUser } = useBoardStore();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [meta, setMeta] = useState<{ fetchedAt: string; boardName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (opts?: { force?: boolean; p?: PeriodKey }) => {
    const p = opts?.p || period;
    if (opts?.force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('ต้อง login ก่อน');
      const params = new URLSearchParams({ period: p });
      if (opts?.force) params.set('force', '1');
      const r = await fetch(`/api/trello-sync?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await r.json();
      if (!r.ok || !body.ok) throw new Error(body.error || `HTTP ${r.status}`);
      setKpi(body.kpi);
      setMeta(body.meta);
    } catch (e: any) {
      setError(e.message || 'load failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { load(); }, []); // initial

  const handlePeriod = (p: PeriodKey) => {
    setPeriod(p);
    load({ p });
  };

  const handleExport = async () => {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const url = `/api/kpi-export?period=${period}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!r.ok) { alert('Export ไม่สำเร็จ'); return; }
    const blob = await r.blob();
    const cd = r.headers.get('content-disposition') || '';
    const m = cd.match(/filename="([^"]+)"/);
    const filename = m?.[1] || `taskflow-kpi-${period}.csv`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#1d2125]/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <LayoutGrid size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-sm sm:text-base">TaskFlow KPI</h1>
            <p className="text-[11px] text-gray-400 truncate">
              {meta?.boardName ? `Trello: ${meta.boardName}` : 'Dashboard'}
              {meta?.fetchedAt && ` · อัพเดท ${fmtRelative(meta.fetchedAt)}`}
            </p>
          </div>
          <button
            onClick={() => load({ force: true })}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-medium transition-colors press disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-medium transition-colors press"
            title="Export CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <a
            href="https://trello.com/b/BYcsIapc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg text-xs font-medium transition-colors press"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Trello</span>
          </a>
          {currentUser && (
            <div className="flex items-center gap-2 ml-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white/20"
                style={{ backgroundColor: currentUser.color }} title={currentUser.name}>{currentUser.initials}</div>
              <button onClick={async () => { await signOut(); window.location.reload(); }}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400" title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Period filter */}
      <div className="sticky top-[68px] z-[9] bg-[#0d1117]/95 backdrop-blur border-b border-white/5 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => handlePeriod(p.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all press ${
                period === p.key
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="spinner w-10 h-10" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <AlertCircle size={16} /> <span className="font-medium">โหลดข้อมูลไม่ได้</span>
            </div>
            <p className="text-sm text-red-300/80">{error}</p>
            <button onClick={() => load()} className="mt-3 text-xs text-blue-400 hover:underline">ลองอีกครั้ง</button>
          </div>
        )}

        {kpi && !loading && (
          <>
            {/* Overall metrics */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                ภาพรวม · <span className="text-gray-300">{kpi.period.label}</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={<Activity size={16} />} label="งานทั้งหมด" value={kpi.overall.totalCards} sub={`${kpi.overall.activeCards} active`} color="blue" />
                <KpiCard icon={<CheckCircle2 size={16} />} label={`เสร็จใน${kpi.period.label}`} value={kpi.overall.completedCards} sub={`${kpi.overall.completedThisWeek} สัปดาห์นี้`} color="green" />
                <KpiCard icon={<TrendingUp size={16} />} label="On-time" value={`${kpi.overall.onTimePct}%`} sub={`${Math.round(kpi.overall.onTimeRate * kpi.overall.completedCards)} ตรงเวลา`} color="purple" />
                <KpiCard icon={<Clock size={16} />} label="Cycle time" value={`${kpi.overall.avgCycleTimeDays}d`} sub="เฉลี่ย สร้าง→เสร็จ" color="orange" />
              </div>
            </section>

            {/* Bottlenecks alert */}
            {kpi.bottlenecks.length > 0 && (
              <section className="bg-gradient-to-br from-yellow-900/20 to-orange-900/10 border border-yellow-700/30 rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={18} className="text-yellow-400" />
                  <h3 className="font-semibold text-sm text-yellow-200">
                    🚨 Bottleneck — งานค้าง {kpi.bottlenecks.length} ใบ
                  </h3>
                </div>
                <div className="space-y-2">
                  {kpi.bottlenecks.slice(0, 5).map((b) => (
                    <a
                      key={b.cardId}
                      href={b.url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-100 truncate font-medium group-hover:text-white">
                          {b.cardName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {b.listName}
                          {b.members.length > 0 && ` · ${b.members.join(', ')}`}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-xs font-bold">
                          {b.daysStuck}d
                        </span>
                        <ExternalLink size={12} className="text-gray-500 group-hover:text-gray-300" />
                      </div>
                    </a>
                  ))}
                  {kpi.bottlenecks.length > 5 && (
                    <p className="text-xs text-yellow-400/60 text-center pt-1">
                      ...และอีก {kpi.bottlenecks.length - 5} ใบ (ดูทั้งหมดใน CSV)
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Throughput trend (line-style) */}
            <section className="bg-[#161b22] rounded-xl border border-white/5 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={16} className="text-gray-400" />
                <h3 className="font-semibold text-sm">Throughput — 12 สัปดาห์ล่าสุด</h3>
              </div>
              <ThroughputChart data={kpi.throughput} />
            </section>

            {/* Per-designer */}
            <section className="bg-[#161b22] rounded-xl border border-white/5 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-gray-400" />
                <h3 className="font-semibold text-sm">Performance ต่อ Designer</h3>
              </div>
              {kpi.byDesigner.length === 0 ? (
                <p className="text-sm text-gray-500 italic">ยังไม่มี member ทำงาน</p>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left py-2 px-4 sm:pl-0 sm:pr-2">Designer</th>
                        <th className="text-right py-2 px-2">มอบหมาย</th>
                        <th className="text-right py-2 px-2">เสร็จรวม</th>
                        <th className="text-right py-2 px-2">เดือนนี้</th>
                        <th className="text-right py-2 px-2">On-time</th>
                        <th className="text-right py-2 pl-2 px-4 sm:pr-0">Cycle (d)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpi.byDesigner.map((d) => (
                        <tr key={d.id} className="border-t border-white/5 hover:bg-white/3">
                          <td className="py-2.5 px-4 sm:pl-0 sm:pr-2 font-medium text-gray-200">{d.name}</td>
                          <td className="py-2.5 px-2 text-right text-gray-400">{d.cardsAssigned}</td>
                          <td className="py-2.5 px-2 text-right text-gray-400">{d.cardsCompleted}</td>
                          <td className="py-2.5 px-2 text-right">
                            <span className="inline-block px-2 py-0.5 rounded bg-green-500/15 text-green-300 text-xs font-medium">
                              {d.cardsCompletedThisMonth}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right text-gray-300">{Math.round(d.onTimeRate * 100)}%</td>
                          <td className="py-2.5 pl-2 px-4 sm:pr-0 text-right text-gray-300">{d.avgCycleTimeDays.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Lists + Labels */}
            <div className="grid md:grid-cols-2 gap-4">
              <section className="bg-[#161b22] rounded-xl border border-white/5 p-4 sm:p-5">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <LayoutGrid size={16} className="text-gray-400" /> งานในแต่ละ List
                </h3>
                <div className="space-y-2">
                  {kpi.byList.map((l) => {
                    const max = Math.max(...kpi.byList.map((x) => x.activeCount), 1);
                    return (
                      <div key={l.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-300 truncate flex-1">{l.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500 w-6 text-right">{l.activeCount}</span>
                          <div className="w-20 sm:w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                              style={{ width: `${(l.activeCount / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-[#161b22] rounded-xl border border-white/5 p-4 sm:p-5">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <Tag size={16} className="text-gray-400" /> งานต่อ Label
                </h3>
                {kpi.byLabel.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">ยังไม่มี label ใช้</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {kpi.byLabel.map((l) => (
                      <div key={l.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: `${COLOR_TO_HEX[l.color] || l.color}22`, color: COLOR_TO_HEX[l.color] || '#e5e7eb' }}>
                        <span>{l.name || '(no name)'}</span>
                        <span className="bg-black/30 rounded px-1.5 py-0.5">{l.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <footer className="text-center text-xs text-gray-600 py-4">
              ข้อมูลจาก Trello · cache 10 นาที · {meta?.fetchedAt ? `pulled ${new Date(meta.fetchedAt).toLocaleString('th-TH')}` : ''}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'from-blue-500/10 to-blue-600/5 text-blue-300 border-blue-500/20',
    green: 'from-green-500/10 to-emerald-600/5 text-green-300 border-green-500/20',
    purple: 'from-purple-500/10 to-pink-600/5 text-purple-300 border-purple-500/20',
    orange: 'from-orange-500/10 to-red-600/5 text-orange-300 border-orange-500/20',
  };
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl border p-4 hover-lift`}>
      <div className="flex items-center gap-1.5 mb-2 opacity-80">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function ThroughputChart({ data }: { data: { weekStart: string; completed: number }[] }) {
  const max = Math.max(...data.map((d) => d.completed), 1);
  // SVG line chart with gradient fill
  const W = 600;
  const H = 140;
  const padding = { top: 10, right: 8, bottom: 24, left: 8 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;
  const xStep = innerW / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerH - (d.completed / max) * innerH,
    v: d.completed,
    label: d.weekStart.slice(5),
  }));

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36" preserveAspectRatio="none">
        <defs>
          <linearGradient id="throughputGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* grid lines */}
        {[0, 0.5, 1].map((t) => (
          <line key={t}
            x1={padding.left} x2={W - padding.right}
            y1={padding.top + innerH * t} y2={padding.top + innerH * t}
            stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        ))}
        {/* area */}
        <path d={areaPath} fill="url(#throughputGrad)" />
        {/* line */}
        <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#60a5fa" />
            <text x={p.x} y={H - 6} textAnchor="middle" className="fill-gray-600" fontSize="9">{p.label}</text>
            {p.v > 0 && (
              <text x={p.x} y={p.y - 6} textAnchor="middle" className="fill-blue-300" fontSize="9" fontWeight="600">{p.v}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function fmtRelative(iso: string): string {
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diffSec < 60) return 'เมื่อกี้';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} นาทีก่อน`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} ชั่วโมงก่อน`;
  return `${Math.round(diffSec / 86400)} วันก่อน`;
}
