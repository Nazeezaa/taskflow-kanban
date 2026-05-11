'use client';

import { useState, useRef } from 'react';
import {
  X, Calendar, Tag, Users, CheckSquare, MessageSquare, Image, Trash2,
  Eye, EyeOff, AlignLeft, Clock, Plus, Paperclip, ExternalLink, MoreHorizontal
} from 'lucide-react';
import type { Card, Label, Member, Attachment } from '@/types';
import { useBoardStore } from '@/store/boardStore';

export default function CardModal() {
  const {
    boards, activeBoardId, selectedCardId, setSelectedCard,
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
      <div className="relative bg-[#323940] rounded-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
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
    toggleChecklistItem, toggleCardLabel, toggleCardMember,
    uploadAttachment, deleteAttachment, setAttachmentAsCover,
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
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleSaveTitle = () => {
    if (title.trim() && title !== card.title) updateCard(card.id, { title: title.trim() });
  };
  const handleSaveDesc = () => {
    if (desc !== card.description) updateCard(card.id, { description: desc });
  };
  const handleAddComment = () => {
    if (commentText.trim()) { addComment(card.id, commentText.trim(), 'คุณ'); setCommentText(''); }
  };
  const handleDelete = () => {
    if (confirm('ต้องการลบการ์ดนี้?')) { deleteCard(card.id); onClose(); }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadAttachment(card.id, file);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    await uploadAttachment(card.id, file);
    setUploading(false);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const isImage = (type: string) => type.startsWith('image/');

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      {/* Cover */}
      {card.coverImage ? (
        <div className="relative">
          <img src={card.coverImage} alt="" className="w-full h-44 object-cover rounded-t-xl" />
          <button onClick={() => updateCard(card.id, { coverImage: undefined })}
            className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg hover:bg-black/70 text-white">
            <X size={16} />
          </button>
        </div>
      ) : card.coverColor ? (
        <div className="h-24 rounded-t-xl" style={{ backgroundColor: card.coverColor }} />
      ) : null}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            className="text-xl font-semibold text-white bg-transparent w-full outline-none hover:bg-white/5 px-2 py-1 -mx-2 rounded"
          />
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4 px-0">ใน list: <span className="text-gray-300">{listTitle}</span></p>

        {/* Quick action bar — like Trello */}
        <div className="flex flex-wrap gap-2 mb-5">
          <QuickBtn icon={<Plus size={14} />} label="Add" onClick={() => fileInputRef.current?.click()} />
          <QuickBtn icon={<Tag size={14} />} label="Labels" onClick={() => setShowLabels(!showLabels)} />
          <QuickBtn icon={<Calendar size={14} />} label="Dates" onClick={() => setShowDatePicker(!showDatePicker)} />
          <QuickBtn icon={<CheckSquare size={14} />} label="Checklist" onClick={() => setShowAddChecklist(!showAddChecklist)} />
          <QuickBtn icon={<Paperclip size={14} />} label="Attachment" onClick={() => fileInputRef.current?.click()} />
        </div>

        {/* Labels dropdown */}
        {showLabels && (
          <div className="mb-4 bg-[#282e33] rounded-lg border border-white/10 p-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">ป้ายกำกับ</p>
            <div className="flex flex-wrap gap-2">
              {board.labels.map((l: Label) => (
                <label key={l.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={card.labels.some(cl => cl.id === l.id)}
                    onChange={() => toggleCardLabel(card.id, l)} className="rounded" />
                  <span className="px-2.5 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: l.color }}>
                    {l.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Date picker dropdown */}
        {showDatePicker && (
          <div className="mb-4 bg-[#282e33] rounded-lg border border-white/10 p-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">กำหนดส่ง</p>
            <input type="date" value={dueDate}
              onChange={e => { setDueDate(e.target.value); updateCard(card.id, { dueDate: e.target.value }); }}
              className="bg-white/10 text-sm text-white rounded px-3 py-1.5 outline-none" />
            {dueDate && (
              <button onClick={() => { setDueDate(''); updateCard(card.id, { dueDate: undefined }); }}
                className="ml-2 text-xs text-red-400 hover:text-red-300">ลบวันกำหนด</button>
            )}
          </div>
        )}

        {/* Add checklist dropdown */}
        {showAddChecklist && (
          <div className="mb-4 bg-[#282e33] rounded-lg border border-white/10 p-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">เพิ่ม Checklist</p>
            <div className="flex gap-2">
              <input autoFocus value={newChecklistTitle} onChange={e => setNewChecklistTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newChecklistTitle.trim()) {
                    addChecklist(card.id, newChecklistTitle.trim()); setNewChecklistTitle(''); setShowAddChecklist(false);
                  }
                }}
                placeholder="ชื่อ Checklist..." className="flex-1 bg-white/10 text-sm text-white rounded px-3 py-1.5 outline-none placeholder-gray-500" />
              <button onClick={() => {
                if (newChecklistTitle.trim()) { addChecklist(card.id, newChecklistTitle.trim()); setNewChecklistTitle(''); setShowAddChecklist(false); }
              }} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500">เพิ่ม</button>
            </div>
          </div>
        )}

        {/* Members dropdown */}
        {showMembers && (
          <div className="mb-4 bg-[#282e33] rounded-lg border border-white/10 p-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">สมาชิก</p>
            {board.members.map((m: Member) => (
              <label key={m.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer">
                <input type="checkbox" checked={card.members.some(cm => cm.id === m.id)}
                  onChange={() => toggleCardMember(card.id, m)} className="rounded" />
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: m.color }}>{m.initials}</div>
                <span className="text-sm text-gray-300">{m.name}</span>
              </label>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[1fr_200px] gap-6">
          {/* Main content */}
          <div className="space-y-5">
            {/* Labels */}
            {card.labels.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Labels</p>
                <div className="flex flex-wrap gap-1.5">
                  {card.labels.map(l => (
                    <span key={l.id} className="px-3 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: l.color }}>
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Members */}
            {card.members.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Members</p>
                <div className="flex items-center gap-1">
                  {card.members.map(m => (
                    <div key={m.id} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#323940]"
                      style={{ backgroundColor: m.color }} title={m.name}>{m.initials}</div>
                  ))}
                  <button onClick={() => setShowMembers(!showMembers)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-gray-400">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Due date */}
            {(card.dueDate || card.startDate) && (
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-gray-400" />
                {card.startDate && <span className="text-gray-300">เริ่ม: {card.startDate}</span>}
                {card.dueDate && (
                  <span className={`px-2 py-0.5 rounded ${
                    new Date(card.dueDate) < new Date() ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-300'
                  }`}>กำหนด: {card.dueDate}</span>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-gray-300 text-sm font-medium">
                <AlignLeft size={16} /> Description
              </div>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} onBlur={handleSaveDesc}
                placeholder="Add a more detailed description..."
                className="w-full bg-white/5 text-sm text-gray-300 rounded-lg p-3 min-h-[80px] outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-gray-500" />
            </div>

            {/* Attachments */}
            {card.attachments.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                    <Paperclip size={16} /> Attachments
                  </div>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-400 hover:text-white bg-white/10 px-2 py-1 rounded">Add</button>
                </div>
                <div className="space-y-2">
                  {card.attachments.map(att => (
                    <AttachmentItem key={att.id} att={att} cardId={card.id}
                      onDelete={() => deleteAttachment(card.id, att.id)}
                      onSetCover={() => setAttachmentAsCover(card.id, att.id, att.url)}
                      isImage={isImage(att.type)}
                      formatDate={formatDate}
                      formatFileSize={formatFileSize}
                    />
                  ))}
                </div>
              </div>
            )}

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
                      <label key={item.id} className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded cursor-pointer">
                        <input type="checkbox" checked={item.completed}
                          onChange={() => toggleChecklistItem(card.id, cl.id, item.id)} className="rounded border-gray-500 text-blue-500 bg-transparent" />
                        <span className={`text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{item.text}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input value={checklistInputs[cl.id] || ''}
                      onChange={e => setChecklistInputs({ ...checklistInputs, [cl.id]: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && checklistInputs[cl.id]?.trim()) {
                          addChecklistItem(card.id, cl.id, checklistInputs[cl.id].trim());
                          setChecklistInputs({ ...checklistInputs, [cl.id]: '' });
                        }
                      }}
                      placeholder="เพิ่มรายการ..."
                      className="flex-1 bg-white/5 text-sm text-gray-300 rounded px-2 py-1 outline-none placeholder-gray-500" />
                    <button onClick={() => {
                      if (checklistInputs[cl.id]?.trim()) {
                        addChecklistItem(card.id, cl.id, checklistInputs[cl.id].trim());
                        setChecklistInputs({ ...checklistInputs, [cl.id]: '' });
                      }
                    }} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500">เพิ่ม</button>
                  </div>
                </div>
              );
            })}

            {/* Comments */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-gray-300 text-sm font-medium">
                <MessageSquare size={16} /> Comments and activity
              </div>
              <div className="flex gap-2 mb-3">
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                  placeholder="Write a comment..."
                  className="flex-1 bg-white/5 text-sm text-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500" />
                <button onClick={handleAddComment} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500">ส่ง</button>
              </div>
              <div className="space-y-2">
                {[...card.comments].reverse().map(c => (
                  <div key={c.id} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                        {c.authorName.slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium text-gray-300">{c.authorName}</span>
                      <span className="text-xs text-gray-500">{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-400 ml-9">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium mb-1">เพิ่มใน Card</p>

            <input ref={fileInputRef} type="file" onChange={handleUploadAttachment} className="hidden" />
            <input ref={coverInputRef} type="file" accept="image/*" onChange={handleUploadCover} className="hidden" />

            <button onClick={() => setShowLabels(!showLabels)} className="sidebar-btn">
              <Tag size={14} /> ป้ายกำกับ
            </button>
            <button onClick={() => setShowMembers(!showMembers)} className="sidebar-btn">
              <Users size={14} /> สมาชิก
            </button>
            <button onClick={() => setShowDatePicker(!showDatePicker)} className="sidebar-btn">
              <Calendar size={14} /> กำหนดส่ง
            </button>
            <button onClick={() => setShowAddChecklist(!showAddChecklist)} className="sidebar-btn">
              <CheckSquare size={14} /> Checklist
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="sidebar-btn">
              <Paperclip size={14} /> {uploading ? 'กำลังอัพ...' : 'Attachment'}
            </button>
            <button onClick={() => coverInputRef.current?.click()} className="sidebar-btn">
              <Image size={14} /> รูปปก
            </button>
            <button onClick={() => updateCard(card.id, { isWatching: !card.isWatching })} className="sidebar-btn">
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
    </div>
  );
}

function AttachmentItem({ att, cardId, onDelete, onSetCover, isImage, formatDate, formatFileSize }: {
  att: Attachment; cardId: string; onDelete: () => void; onSetCover: () => void;
  isImage: boolean; formatDate: (s: string) => string; formatFileSize: (n?: number) => string;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="flex gap-3 p-2 rounded-lg hover:bg-white/5 group">
      {/* Thumbnail */}
      <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center">
        {isImage ? (
          <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-gray-400 font-mono uppercase">
            {att.name.split('.').pop()}
          </span>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate font-medium">{att.name}</p>
        <p className="text-xs text-gray-500">
          Added {formatDate(att.createdAt)}
          {att.size ? ` · ${formatFileSize(att.size)}` : ''}
          {att.isCover && <span className="ml-1 text-blue-400">· Cover</span>}
        </p>
        <div className="flex gap-3 mt-1">
          <a href={att.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
            <ExternalLink size={11} /> Open
          </a>
          {isImage && (
            <button onClick={onSetCover} className="text-xs text-gray-400 hover:text-white">
              {att.isCover ? 'Remove cover' : 'Make cover'}
            </button>
          )}
          <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300">Delete</button>
        </div>
      </div>
    </div>
  );
}

function QuickBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 text-sm rounded-lg transition-colors">
      {icon} {label}
    </button>
  );
}
