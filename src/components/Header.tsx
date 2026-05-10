'use client';

import { Search, Sparkles, Bell, Star, LayoutGrid, BarChart3, Calendar, Zap, Clock } from 'lucide-react';
import { useBoardStore } from '@/store/boardStore';

export default function Header() {
  const {
    boards, activeBoardId, searchQuery, setSearchQuery,
    toggleAI, showAI, toggleDashboard, showDashboard,
    activeView, setActiveView, toggleActivity, showActivity,
    toggleAutomation,
  } = useBoardStore();
  const board = boards.find(b => b.id === activeBoardId);

  return (
    <header className="h-14 bg-[#1d2125]/90 backdrop-blur border-b border-white/10 flex items-center px-4 gap-2 flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <LayoutGrid size={16} className="text-white" />
        </div>
        <h1 className="text-base font-bold text-white hidden sm:block">TaskFlow</h1>
      </div>

      <div className="h-6 w-px bg-white/10 mx-1" />

      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-white">{board?.title || 'เลือกบอร์ด'}</h2>
        <button className="p-1 hover:bg-white/10 rounded text-gray-400">
          <Star size={16} />
        </button>
      </div>

      <div className="h-6 w-px bg-white/10 mx-1" />

      {/* View switcher */}
      <div className="flex items-center bg-white/5 rounded-lg p-0.5">
        <button
          onClick={() => setActiveView('board')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            activeView === 'board' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <LayoutGrid size={13} /> Board
        </button>
        <button
          onClick={() => setActiveView('calendar')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            activeView === 'calendar' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Calendar size={13} /> Calendar
        </button>
      </div>

      <div className="flex-1" />

      {/* Members */}
      {board && (
        <div className="hidden md:flex -space-x-1.5 mr-1">
          {board.members.slice(0, 4).map(m => (
            <div
              key={m.id}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#1d2125]"
              style={{ backgroundColor: m.color }}
              title={m.name}
            >
              {m.initials}
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative hidden sm:block">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="ค้นหา..."
          className="w-40 bg-white/5 text-sm text-white rounded-lg pl-8 pr-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
        />
      </div>

      {/* Automation */}
      <button
        onClick={toggleAutomation}
        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
        title="Automation"
      >
        <Zap size={17} />
      </button>

      {/* Activity */}
      <button
        onClick={toggleActivity}
        className={`p-2 rounded-lg transition-colors ${
          showActivity ? 'bg-amber-600 text-white' : 'hover:bg-white/10 text-gray-400'
        }`}
        title="Activity Feed"
      >
        <Clock size={17} />
      </button>

      {/* KPI */}
      <button
        onClick={toggleDashboard}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          showDashboard
            ? 'bg-emerald-600 text-white'
            : 'bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 text-emerald-300 hover:from-emerald-500/20 hover:to-cyan-500/20'
        }`}
      >
        <BarChart3 size={14} />
        <span className="hidden sm:inline">KPI</span>
      </button>

      {/* Notification */}
      <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors relative">
        <Bell size={17} />
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* AI */}
      <button
        onClick={toggleAI}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          showAI
            ? 'bg-purple-600 text-white'
            : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-300 hover:from-purple-500/20 hover:to-blue-500/20'
        }`}
      >
        <Sparkles size={14} />
        <span className="hidden sm:inline">AI</span>
      </button>
    </header>
  );
}
