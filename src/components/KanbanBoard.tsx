'use client';

import { useState, useCallback } from 'react';
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  DragOverlay, DragStartEvent, DragEndEvent, DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, X } from 'lucide-react';
import { useBoardStore } from '@/store/boardStore';
import KanbanList from './KanbanList';
import KanbanCard from './KanbanCard';
import type { Card } from '@/types';

export default function KanbanBoard() {
  const { boards, activeBoardId, addList, moveCard } = useBoardStore();
  const board = boards.find(b => b.id === activeBoardId);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'card') {
      setActiveCard(active.data.current.card);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'card') {
      let targetListId: string;
      let targetIndex: number;

      if (overData?.type === 'card') {
        targetListId = overData.card.listId;
        const targetList = board?.lists.find(l => l.id === targetListId);
        targetIndex = targetList?.cards.findIndex(c => c.id === over.id) ?? 0;
      } else if (String(over.id).startsWith('list-')) {
        targetListId = String(over.id).replace('list-', '');
        const targetList = board?.lists.find(l => l.id === targetListId);
        targetIndex = targetList?.cards.length ?? 0;
      } else {
        return;
      }

      moveCard(String(active.id), targetListId, targetIndex);
    }
  }, [board, moveCard]);

  const handleDragOver = useCallback((event: DragOverEvent) => {}, []);

  if (!board) return <div className="text-white p-8">เลือกบอร์ดก่อน</div>;

  const handleAddList = () => {
    if (newListTitle.trim()) {
      addList(board.id, newListTitle.trim());
      setNewListTitle('');
      setIsAddingList(false);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 p-4 h-full items-start">
          <SortableContext items={board.lists.map(l => l.id)} strategy={horizontalListSortingStrategy}>
            {board.lists.map(list => (
              <KanbanList key={list.id} list={list} />
            ))}
          </SortableContext>

          {/* Add list button */}
          <div className="w-72 flex-shrink-0">
            {isAddingList ? (
              <div className="bg-[#101204] rounded-xl p-2">
                <input
                  autoFocus
                  value={newListTitle}
                  onChange={e => setNewListTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddList(); }}
                  placeholder="ชื่อ List..."
                  className="w-full bg-white/5 text-sm text-white rounded px-2 py-1.5 outline-none mb-2 placeholder-gray-500"
                />
                <div className="flex items-center gap-2">
                  <button onClick={handleAddList} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500">
                    เพิ่ม List
                  </button>
                  <button onClick={() => { setIsAddingList(false); setNewListTitle(''); }} className="p-1 text-gray-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingList(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300 transition-colors"
              >
                <Plus size={16} /> เพิ่ม List อื่น
              </button>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeCard && (
          <div className="rotate-3 opacity-90">
            <KanbanCard card={activeCard} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
