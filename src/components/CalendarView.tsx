'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { useBoardStore } from '@/store/boardStore';
import type { Card } from '@/types';

export default function CalendarView() {
  const { boards, activeBoardId, setSelectedCard } = useBoardStore();
  const board = boards.find(b => b.id === activeBoardId);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const allCards = useMemo(() => {
    if (!board) return [];
    return board.lists.flatMap(l =>
      l.cards.map(c => ({ ...c, _listTitle: l.title, _listColor: l.color }))
    );
  }, [board]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { date: number; month: number; year: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: daysInPrevMonth - i, month: month - 1, year, isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: i, month, year, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: i, month: month + 1, year, isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const getCardsForDate = (date: number, m: number, y: number) => {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return allCards.filter(c => {
      if (c.dueDate && c.dueDate.startsWith(dateStr)) return true;
      if (c.startDate && c.startDate.startsWith(dateStr)) return true;
      if (c.createdAt.startsWith(dateStr)) return true;
      return false;
    });
  };

  const today = new Date();
  const isToday = (date: number, m: number, y: number) =>
    date === today.getDate() && m === today.getMonth() && y === today.getFullYear();

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CalIcon size={20} className="text-blue-400" />
            <h2 className="text-lg font-bold text-white">{monthNames[month]} {year + 543}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 rounded-lg"
            >
              วันนี้
            </button>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-white/5 rounded-xl overflow-hidden">
          {dayNames.map(d => (
            <div key={d} className="bg-[#1a1d23] px-2 py-2 text-center text-xs font-medium text-gray-400">
              {d}
            </div>
          ))}

          {calendarDays.map((day, i) => {
            const cards = getCardsForDate(day.date, day.month, day.year);
            const todayClass = isToday(day.date, day.month, day.year);
            return (
              <div
                key={i}
                className={`bg-[#1a1d23] min-h-[100px] p-1.5 ${
                  !day.isCurrentMonth ? 'opacity-30' : ''
                } ${todayClass ? 'ring-1 ring-blue-500 ring-inset' : ''}`}
              >
                <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  todayClass ? 'bg-blue-500 text-white' : 'text-gray-400'
                }`}>
                  {day.date}
                </span>
                <div className="mt-1 space-y-0.5">
                  {cards.slice(0, 3).map(card => {
                    const isDue = card.dueDate?.startsWith(`${day.year}-${String(day.month + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`);
                    const isOverdue = isDue && new Date(card.dueDate!) < new Date();
                    return (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCard(card.id)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate transition-colors ${
                          isOverdue
                            ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                            : isDue
                              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                              : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                        title={card.title}
                      >
                        {isDue && '📅 '}{card.title}
                      </button>
                    );
                  })}
                  {cards.length > 3 && (
                    <span className="text-[10px] text-gray-500 pl-1">+{cards.length - 3} อื่นๆ</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 px-1">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded bg-amber-500/30" /> กำหนดส่ง
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded bg-red-500/30" /> เลย deadline
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded bg-white/10" /> สร้าง/เริ่มงาน
          </span>
        </div>
      </div>
    </div>
  );
}
