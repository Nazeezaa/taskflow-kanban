'use client';

import { useMemo } from 'react';
import { X, ArrowRight, Plus, MessageSquare, UserPlus, Tag, CheckCircle2, Clock } from 'lucide-react';
import { useBoardStore } from '@/store/boardStore';
import type { CardActivity } from '@/types';

export default function ActivityFeed({ onClose }: { onClose: () => void }) {
  const { boards, activeBoardId } = useBoardStore();
  const board = boards.find(b => b.id === activeBoardId);

  const activities = useMemo(() => {
    if (!board) return [];
    const all: (CardActivity & { cardTitle: string })[] = [];
    for (const list of board.lists) {
      for (const card of list.cards) {
        for (const act of (card.activities || [])) {
          all.push({ ...act, cardTitle: card.title });
        }
      }
    }
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
  }, [board]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'created': return <Plus size={14} className="text-emerald-400" />;
      case 'moved': return <ArrowRight size={14} className="text-blue-400" />;
      case 'completed': return <CheckCircle2 size={14} className="text-green-400" />;
      case 'comment': return <MessageSquare size={14} className="text-amber-400" />;
      case 'assigned': return <UserPlus size={14} className="text-pink-400" />;
      case 'label': return <Tag size={14} className="text-purple-400" />;
      default: return <Clock size={14} className="text-gray-400" />;
    }
  };

  const getMessage = (act: CardActivity & { cardTitle: string }) => {
    switch (act.type) {
      case 'created': return <><strong className="text-gray-200">{act.cardTitle}</strong> ถูกสร้างขึ้น</>;
      case 'moved': return <><strong className="text-gray-200">{act.cardTitle}</strong> ย้ายจาก <span className="text-blue-400">{act.fromListTitle}</span> ไป <span className="text-blue-400">{act.toListTitle}</span></>;
      case 'completed': return <><strong className="text-gray-200">{act.cardTitle}</strong> เสร็จแล้ว ✅</>;
      default: return <><strong className="text-gray-200">{act.cardTitle}</strong> มีการอัพเดท</>;
    }
  };

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อกี้';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} วันที่แล้ว`;
    return new Date(ts).toLocaleDateString('th-TH');
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-[#1a1d23] border-l border-white/10 z-40 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Activity Feed</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-gray-400">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activities.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-12">ยังไม่มีกิจกรรม</p>
        ) : (
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-white/5" />
            {activities.map((act, i) => (
              <div key={act.id} className="relative flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 z-10">
                  {getIcon(act.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 leading-relaxed">{getMessage(act)}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{formatTime(act.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
