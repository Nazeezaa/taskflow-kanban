'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, MoreHorizontal, X, Copy } from 'lucide-react';
import type { List } from '@/types';
import { useBoardStore } from '@/store/boardStore';
import KanbanCard from './KanbanCard';
import CardTemplates from './CardTemplates';

export default function KanbanList({ list }: { list: List }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { addCard, deleteList, searchQuery, showArchived } = useBoardStore();

  const { setNodeRef, isOver } = useDroppable({
    id: `list-${list.id}`,
    data: { type: 'list', list },
  });

  const baseCards = showArchived ? list.cards : list.cards.filter((c) => !c.archived);
  const filteredCards = searchQuery
    ? baseCards.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : baseCards;

  const handleAdd = () => {
    if (newTitle.trim()) {
      addCard(list.id, newTitle.trim());
      setNewTitle('');
      setIsAdding(false);
    }
  };

  return (
    <div className="w-72 flex-shrink-0 flex flex-col max-h-[calc(100vh-120px)]">
      <div className="bg-[#101204] rounded-xl flex flex-col max-h-full">
        <div className="flex items-center justify-between px-3 py-2.5">
          <h3 className="text-sm font-semibold text-gray-200 truncate flex-1">{list.title}</h3>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">{list.cards.length}</span>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded hover:bg-white/10 text-gray-400"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-[#282e33] rounded-lg shadow-xl border border-white/10 py-1 w-48">
                    <button
                      onClick={() => { deleteList(list.id); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/5"
                    >
                      ลบ List นี้
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div
          ref={setNodeRef}
          className={`flex-1 overflow-y-auto px-2 pb-2 min-h-[4px] transition-colors ${
            isOver ? 'bg-blue-500/10' : ''
          }`}
        >
          <SortableContext items={filteredCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {filteredCards.map(card => (
              <KanbanCard key={card.id} card={card} />
            ))}
          </SortableContext>
        </div>

        <div className="px-2 pb-2">
          {isAdding ? (
            <div className="bg-[#22272b] rounded-lg p-2">
              <textarea
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
                placeholder="ใส่ชื่อการ์ด..."
                className="w-full bg-transparent text-sm text-white resize-none outline-none placeholder-gray-500"
                rows={2}
              />
              <div className="flex items-center gap-2 mt-1">
                <button onClick={handleAdd} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500">
                  เพิ่มการ์ด
                </button>
                <button onClick={() => { setIsAdding(false); setNewTitle(''); }} className="p-1 text-gray-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 flex-1 px-2 py-1.5 text-sm text-gray-400 hover:bg-white/5 rounded-lg transition-colors"
              >
                <Plus size={16} /> เพิ่มการ์ด
              </button>
              <button
                onClick={() => setShowTemplates(true)}
                className="p-1.5 text-gray-400 hover:bg-white/5 rounded-lg transition-colors"
                title="ใช้ Template"
              >
                <Copy size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
      {showTemplates && <CardTemplates listId={list.id} onClose={() => setShowTemplates(false)} />}
    </div>
  );
}
