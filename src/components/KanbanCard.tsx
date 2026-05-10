'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, Paperclip, CheckSquare, Eye, Calendar } from 'lucide-react';
import type { Card } from '@/types';
import { useBoardStore } from '@/store/boardStore';

export default function KanbanCard({ card }: { card: Card }) {
  const setSelectedCard = useBoardStore(s => s.setSelectedCard);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const totalItems = card.checklists.reduce((a, cl) => a + cl.items.length, 0);
  const doneItems = card.checklists.reduce((a, cl) => a + cl.items.filter(i => i.completed).length, 0);

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setSelectedCard(card.id)}
      className="bg-[#22272b] rounded-lg shadow-md cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all group mb-2"
    >
      {card.coverColor && (
        <div className="h-8 rounded-t-lg" style={{ backgroundColor: card.coverColor }} />
      )}
      {card.coverImage && (
        <div className="h-32 rounded-t-lg bg-cover bg-center" style={{ backgroundImage: `url(${card.coverImage})` }} />
      )}

      <div className="p-2.5">
        {card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {card.labels.map(label => (
              <span
                key={label.id}
                className="h-2 w-10 rounded-full inline-block"
                style={{ backgroundColor: label.color }}
                title={label.name}
              />
            ))}
          </div>
        )}

        <p className="text-sm text-gray-200 leading-snug">{card.title}</p>

        <div className="flex items-center gap-2.5 mt-2 flex-wrap">
          {card.isWatching && (
            <Eye size={14} className="text-gray-400" />
          )}

          {(card.dueDate || card.startDate) && (
            <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
              isOverdue ? 'bg-red-500/20 text-red-400' : 'text-gray-400'
            }`}>
              <Calendar size={12} />
              {card.startDate && `Started: ${formatDate(card.startDate)}`}
              {card.dueDate && formatDate(card.dueDate)}
            </span>
          )}

          {card.description && (
            <span className="text-gray-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="9" y2="18" />
              </svg>
            </span>
          )}

          {card.comments.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <MessageSquare size={13} /> {card.comments.length}
            </span>
          )}

          {card.attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Paperclip size={13} /> {card.attachments.length}
            </span>
          )}

          {totalItems > 0 && (
            <span className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded ${
              doneItems === totalItems ? 'bg-green-500/20 text-green-400' : 'text-gray-400'
            }`}>
              <CheckSquare size={13} /> {doneItems}/{totalItems}
            </span>
          )}

          {card.members.length > 0 && (
            <div className="flex -space-x-1.5 ml-auto">
              {card.members.slice(0, 3).map(m => (
                <div
                  key={m.id}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#22272b]"
                  style={{ backgroundColor: m.color }}
                  title={m.name}
                >
                  {m.initials}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
