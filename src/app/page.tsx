'use client';

import { useEffect } from 'react';
import Header from '@/components/Header';
import KanbanBoard from '@/components/KanbanBoard';
import CalendarView from '@/components/CalendarView';
import CardModal from '@/components/CardModal';
import AIAssistant from '@/components/AIAssistant';
import Dashboard from '@/components/Dashboard';
import ActivityFeed from '@/components/ActivityFeed';
import AutomationRules from '@/components/AutomationRules';
import AuthWrapper from '@/components/AuthWrapper';
import InstallPrompt from '@/components/InstallPrompt';
import { useBoardStore } from '@/store/boardStore';

export default function Home() {
  return (
    <AuthWrapper>
      <HomeContent />
    </AuthWrapper>
  );
}

function HomeContent() {
  const {
    selectedCardId, showAI, activeView, loading,
    showActivity, toggleActivity,
    showAutomation, toggleAutomation,
    loadBoard,
  } = useBoardStore();

  useEffect(() => { loadBoard(); }, [loadBoard]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">กำลังโหลด TaskFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <div className={`flex-1 flex overflow-hidden transition-all ${
        showAI ? 'mr-96' : showActivity ? 'mr-80' : ''
      }`}>
        {activeView === 'board' && <KanbanBoard />}
        {activeView === 'calendar' && <CalendarView />}
      </div>
      {selectedCardId && <CardModal />}
      <Dashboard />
      {showActivity && <ActivityFeed onClose={toggleActivity} />}
      {showAutomation && <AutomationRules onClose={toggleAutomation} />}
      <AIAssistant />
      <InstallPrompt />
    </div>
  );
}
