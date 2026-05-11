'use client';

import { useState, useRef } from 'react';
import {
  X, Calendar, Tag, Users, CheckSquare, MessageSquare, Image, Trash2,
  Eye, EyeOff, AlignLeft, Clock, Plus
} from 'lucide-react';
import type { Card, Label, Member } from '@/types';
import { useBoardStore } from '@/store/boardStore';
import { dbUploadCoverImage } from '@/lib/db';

export default function CardModal() {
  const {
    boards, activeBoardId, selectedCardId, setSelectedCard,
    updateCard, deleteCard, addComment, addChecklist, addChecklistItem,
    toggleChecklistItem, toggleCardLabel, toggleCardMember
  } = useBoardStore();

  const board = boards.find(b => b.id === activeBoardId);
  if (!board || !selectedCardId) return null;

  let card: Card | null = null;
  let listTitle = '';
  for (const list of board.lists) {
    const found = list.cards.find(c => c.id === selectedCardId);
    if (found) { card = found; listTitle = list.title; break; }
  }
  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedCard(null)} />
      <div className="relative bg-[#323940] rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <CardModalContent
          card={card}
          listTitle={listTitle}
          board={board}
          onClose={() => setSelectedCard(null)}
        />
      </div>
    </div>
  );
}

function CardModalContent({
  card, listTitle, board, onClose
}: {
  card: Card; listTitle: string; board: any; onClose: () => void;
}) {
  const {
    updateCard, deleteCard, addComment, addChecklist, addChecklistItem,
    toggleChecklistItem, toggleCardLabel, toggleCardMember
  } = useBoardStore();

  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description);
  const [commentText, setCommentText] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDate, setDueDate] = useState(card.dueDate || '');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [checklistInputs, setChecklistInputs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await dbUploadCoverImage(card.id, file);
    if (url) {
      updateCard(card.id, { coverImage: url, coverColor: undefined });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveTitle = () => {
    if (title.trim() && title !== card.title) {
      updateCard(card.id, { title: title.trim() });
    }
  };

  const handleSaveDesc = () => {
    if (desc !== card.description) {
      updateCard(card.id, { description: desc });
    }
  };

  const handleAddComment = () => {
    if (commentText.trim()) {
      addComment(card.id, commentText.trim(), 'คุณ');
      setCommentText('');
    }
  };

  const handleDelete = () => {
    if (confirm('ต้องการลบการ์ดนี้?')) {
      deleteCard(card.id);
      onClose();
    }
  };

  return (
    <div className="p-5">
      {card.coverImage ? (
        <div className="relative -mx-5 -mt-5 mb-4">
          <img src={card.coverImage} alt="" className="w-full h-40 object-cover rounded-t-xl" />
          <button
            onClick={() => updateCard(card.id, { coverImage: undefined })}
            className="absolute top-2 right-2 p-1 bg-black/50 rounded hover:bg-black/70 text-white"
          >
            <X size={14} />
          </button>
        </div>
      ) : card.coverColor ? (
        <div className="h-20 -mx-5 -mt-5 rounded-t-xl mb-4" style={{ backgroundColor: card.coverColor }} />
      ) : null}

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            className="text-xl font-semibold text-white bg-transparent w-full outline-none hover:bg-white/5 px-2 py-1 -mx-2 rounded"
          />
          <p className="text-xs text-gray-400 mt-1 px-0">ใน list: <span className="text-gray-300">{listTitle}</span></p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-gray-400">
          <X size={20} />
        </button>
      </div>

      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {card.labels.map(l => (
            <span key={l.id} className="px-2.5 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      {card.members.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-400">สมาชิก</span>
          <div className="flex -space-x-1">
            {card.members.map(m => (
              <div key={m.id} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#323940]"
                style={{ backgroundColor: m.color }} title={m.name}>
                {m.initials}
              </div>
            ))}
          </div>
        </div>
      )}

      {(card.dueDate || card.startDate) && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Clock size={14} className="text-gray-400" />
          {card.startDate && <span className="text-gray-300">เริ่ม: {card.startDate}</span>}
          {card.dueDate && (
            <span className={`px-2 py-0.5 rounded ${
              new Date(card.dueDate) < new Date() ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-300'
            }`}>
              กำหนด: {card.dueDate}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-[1fr_160px] gap-5">
        <div className="space-y-5">
          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-gray-300 text-sm font-medium">
              <AlignLeft size={16} /> รายละเอียด
            </div>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={handleSaveDesc}
              placeholder="เพิ่มรายละเอียด..."
              className="w-full bg-white/5 text-sm text-gray-300 rounded-lg p-3 min-h-[80px] outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-gray-500"
            />
          </div>

          {/* Checklists */}
          {card.checklists.map(cl => {
            const done = cl.items.filter(i => i.completed).length;
            const pct = cl.items.length ? (done / cl.items.length) * 100 : 0;
            return (
              <div key={cl.id}>
                <div className="flex items-center gap-2 mb-2 text-gray-300 text-sm font-medium">
                  <CheckSquare size={16} /> {cl.title}
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="space-y-1">
                  {cl.items.map(item => (
                    <label key={item.id} className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => toggleChecklistItem(card.id, cl.id, item.id)}
                        className="rounded border-gray-500 text-blue-500 bg-transparent"
                      />
                      <span className={`text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={checklistInputs[cl.id] || ''}
                    onChange={e => setChecklistInputs({ ...checklistInputs, [cl.id]: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && checklistInputs[cl.id]?.trim()) {
                        addChecklistItem(card.id, cl.id, checklistInputs[cl.id].trim());
                        setChecklistInputs({ ...checklistInputs, [cl.id]: '' });
                      }
                    }}
                    placeholder="เพิ่มรายการ..."
                    className="flex-1 bg-white/5 text-sm text-gray-300 rounded px-2 py-1 outline-none placeholder-gray-500"
                  />
                  <button
                    onClick={() => {
                      if (checklistInputs[cl.id]?.trim()) {
                        addChecklistItem(card.id, cl.id, checklistInputs[cl.id].trim());
                        setChecklistInputs({ ...checklistInputs, [cl.id]: '' });
                      }
                    }}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
                  >
                    เพิ่ม
                  </button>
                </div>
              </div>
            );
          })}

          {/* Comments */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-gray-300 text-sm font-medium">
              <MessageSquare size={16} /> ความคิดเห็น
            </div>
            <div className="flex gap-2 mb-3">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                placeholder="เขียนความคิดเห็น..."
                className="flex-1 bg-white/5 text-sm text-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
              />
              <button onClick={handleAddComment} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500">
                ส่ง
              </button>
            </div>
            <div className="space-y-2">
              {[...card.comments].reverse().map(c => (
                <div key={c.id} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-300">{c.authorName}</span>
                    <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('th-TH')}</span>
                  </div>
                  <p className="text-sm text-gray-400">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium mb-1">เพิ่มใน Card</p>

          <div className="relative">
            <button onClick={() => setShowLabels(!showLabels)} className="sidebar-btn">
              <Tag size={14} /> ป้ายกำกับ
            </button>
            {showLabels && (
              <div className="absolute left-0 top-8 z-20 bg-[#282e33] rounded-lg shadow-xl border border-white/10 p-2 w-52">
                {board.labels.map((l: Label) => (
                  <label key={l.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={card.labels.some(cl => cl.id === l.id)}
                      onChange={() => toggleCardLabel(card.id, l)}
                      className="rounded"
                    />
                    <span className="w-full h-6 rounded flex items-center px-2 text-xs text-white font-medium" style={{ backgroundColor: l.color }}>
                      {l.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setShowMembers(!showMembers)} className="sidebar-btn">
              <Users size={14} /> สมาชิก
            </button>
            {showMembers && (
              <div className="absolute left-0 top-8 z-20 bg-[#282e33] rounded-lg shadow-xl border border-white/10 p-2 w-52">
                {board.members.map((m: Member) => (
                  <label key={m.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={card.members.some(cm => cm.id === m.id)}
                      onChange={() => toggleCardMember(card.id, m)}
                      className="rounded"
                    />
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: m.color }}>
                      {m.initials}
                    </div>
                    <span className="text-sm text-gray-300">{m.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setShowDatePicker(!showDatePicker)} className="sidebar-btn">
              <Calendar size={14} /> กำหนดส่ง
            </button>
            {showDatePicker && (
              <div className="absolute left-0 top-8 z-20 bg-[#282e33] rounded-lg shadow-xl border border-white/10 p-3 w-52">
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => { setDueDate(e.target.value); updateCard(card.id, { dueDate: e.target.value }); }}
                  className="w-full bg-white/10 text-sm text-white rounded px-2 py-1 outline-none"
                />
                {dueDate && (
                  <button
                    onClick={() => { setDueDate(''); updateCard(card.id, { dueDate: undefined }); }}
                    className="mt-2 text-xs text-red-400 hover:text-red-300"
                  >
                    ลบวันกำหนด
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (showAddChecklist) {
                if (newChecklistTitle.trim()) {
                  addChecklist(card.id, newChecklistTitle.trim());
                  setNewChecklistTitle('');
                }
                setShowAddChecklist(false);
              } else {
                setShowAddChecklist(true);
              }
            }}
            className="sidebar-btn"
          >
            <CheckSquare size={14} /> Checklist
          </button>
          {showAddChecklist && (
            <div className="bg-white/5 rounded p-2">
              <input
                autoFocus
                value={newChecklistTitle}
                onChange={e => setNewChecklistTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newChecklistTitle.trim()) {
                    addChecklist(card.id, newChecklistTitle.trim());
                    setNewChecklistTitle('');
                    setShowAddChecklist(false);
                  }
                }}
                placeholder="ชื่อ Checklist..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder-gray-500 mb-1"
              />
              <button
                onClick={() => {
                  if (newChecklistTitle.trim()) {
                    addChecklist(card.id, newChecklistTitle.trim());
                    setNewChecklistTitle('');
                    setShowAddChecklist(false);
                  }
                }}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
              >
                เพิ่ม
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadCover}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="sidebar-btn"
          >
            <Image size={14} /> {uploading ? 'กำลังอัพ...' : 'รูปปก'}
          </button>

          <button
            onClick={() => updateCard(card.id, { isWatching: !card.isWatching })}
            className="sidebar-btn"
          >
            {card.isWatching ? <EyeOff size={14} /> : <Eye size={14} />}
            {card.isWatching ? 'เลิกติดตาม' : 'ติดตาม'}
          </button>

          <hr className="border-white/10 my-2" />

          <button onClick={handleDelete} className="sidebar-btn text-red-400 hover:!bg-red-500/10">
            <Trash2 size={14} /> ลบการ์ด
          </button>
        </div>
      </div>
    </div>
  );
}
