'use client';

import { useState, useRef, useCallback } from 'react';
import {
  X, Calendar, Tag, Users, CheckSquare, MessageSquare, Image, Trash2,
  Eye, EyeOff, AlignLeft, Clock, Plus, Paperclip, ExternalLink,
  Copy, ArrowRight, Archive, Edit3, MoreHorizontal
} from 'lucide-react';
import type { Card, Label, Member, Attachment, CardActivity } from '@/types';
import { useBoardStore } from '@/store/boardStore';
import { dbUploadFile } from '@/lib/db';

export default function CardModal() {
  const { boards, activeBoardId, selectedCardId, setSelectedCard } = useBoardStore();
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4">
      <div className="absolute inset-0 bg-black/60 animate-backdrop-in" onClick={() => setSelectedCard(null)} />
      <div className="relative bg-[#323940] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-modal-in">
        <ModalContent card={card} listTitle={listTitle} board={board} onClose={() => setSelectedCard(null)} />
      </div>
    </div>
  );
}

function ModalContent({ card, listTitle, board, onClose }: { card: Card; listTitle: string; board: any; onClose: () => void }) {
  const store = useBoardStore();
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description);
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDate, setDueDate] = useState(card.dueDate || '');
  const [startDate, setStartDate] = useState(card.startDate || '');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [checklistInputs, setChecklistInputs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [showMoveCard, setShowMoveCard] = useState(false);
  const [showCopyCard, setShowCopyCard] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentImageRef = useRef<HTMLInputElement>(null);

  const handleSaveTitle = () => { if (title.trim() && title !== card.title) store.updateCard(card.id, { title: title.trim() }); };
  const handleSaveDesc = () => { if (desc !== card.description) store.updateCard(card.id, { description: desc }); };

  const handleAddComment = async () => {
    if (!commentText.trim() && !commentImage) return;
    const authorName = store.currentUser?.name || 'คุณ';
    store.addComment(card.id, commentText.trim() || '(รูปภาพ)', authorName, commentImage || undefined);
    setCommentText('');
    setCommentImage(null);
  };

  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await dbUploadFile(card.id, file);
    if (result) setCommentImage(result.url);
    setUploading(false);
    if (commentImageRef.current) commentImageRef.current.value = '';
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      await store.uploadAttachment(card.id, files[i]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files.length) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      await store.uploadAttachment(card.id, files[i]);
    }
    setUploading(false);
  }, [card.id, store]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          setUploading(true);
          const result = await dbUploadFile(card.id, file);
          if (result) setCommentImage(result.url);
          setUploading(false);
        }
        break;
      }
    }
  }, [card.id]);

  const handleDelete = () => { if (confirm('ลบการ์ดนี้ถาวร?')) { store.deleteCard(card.id); onClose(); } };
  const handleArchive = () => { store.archiveCard(card.id); onClose(); };

  const isImage = (type: string) => type?.startsWith('image/');
  const fmtSize = (b?: number) => !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtShort = (s: string) => new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

  const activityIcon = (type: string) => {
    switch (type) {
      case 'created': return '🆕';
      case 'moved': return '➡️';
      case 'completed': return '✅';
      default: return '📝';
    }
  };

  return (
    <div onDragOver={e => e.preventDefault()} onDrop={handleDrop} onPaste={handlePaste}>
      {/* Cover */}
      {card.coverImage ? (
        <div className="relative group">
          <img src={card.coverImage} alt="" className="w-full h-44 object-cover rounded-t-xl" />
          <button onClick={() => store.removeCover(card.id)}
            className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <X size={16} />
          </button>
        </div>
      ) : card.coverColor ? (
        <div className="h-24 rounded-t-xl" style={{ backgroundColor: card.coverColor }} />
      ) : null}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <input value={title} onChange={e => setTitle(e.target.value)} onBlur={handleSaveTitle}
            className="text-xl font-semibold text-white bg-transparent w-full outline-none hover:bg-white/5 px-2 py-1 -mx-2 rounded" />
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400"><X size={20} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-4">ใน list: <span className="text-gray-300">{listTitle}</span></p>

        {/* Quick action bar */}
        <div className="flex flex-wrap gap-2 mb-5">
          <QBtn icon={<Plus size={14} />} label="Add" onClick={() => fileInputRef.current?.click()} />
          <QBtn icon={<Tag size={14} />} label="Labels" onClick={() => setShowLabels(!showLabels)} />
          <QBtn icon={<Calendar size={14} />} label="Dates" onClick={() => setShowDatePicker(!showDatePicker)} />
          <QBtn icon={<CheckSquare size={14} />} label="Checklist" onClick={() => setShowAddChecklist(!showAddChecklist)} />
          <QBtn icon={<Paperclip size={14} />} label="Attachment" onClick={() => fileInputRef.current?.click()} />
        </div>

        {/* Dropdowns */}
        {showLabels && <DropdownPanel title="ป้ายกำกับ" onClose={() => setShowLabels(false)}>
          <div className="flex flex-wrap gap-2">
            {board.labels.map((l: Label) => (
              <label key={l.id} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={card.labels.some(cl => cl.id === l.id)}
                  onChange={() => store.toggleCardLabel(card.id, l)} className="rounded" />
                <span className="px-2.5 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: l.color }}>{l.name}</span>
              </label>
            ))}
          </div>
        </DropdownPanel>}

        {showDatePicker && <DropdownPanel title="วันที่" onClose={() => setShowDatePicker(false)}>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-400">วันเริ่มต้น</label>
              <input type="date" value={startDate}
                onChange={e => { setStartDate(e.target.value); store.updateCard(card.id, { startDate: e.target.value }); }}
                className="w-full bg-white/10 text-sm text-white rounded px-3 py-1.5 outline-none mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-400">กำหนดส่ง</label>
              <input type="date" value={dueDate}
                onChange={e => { setDueDate(e.target.value); store.updateCard(card.id, { dueDate: e.target.value }); }}
                className="w-full bg-white/10 text-sm text-white rounded px-3 py-1.5 outline-none mt-1" />
            </div>
            {(dueDate || startDate) && (
              <button onClick={() => { setDueDate(''); setStartDate(''); store.updateCard(card.id, { dueDate: undefined, startDate: undefined }); }}
                className="text-xs text-red-400 hover:text-red-300">ลบวันที่ทั้งหมด</button>
            )}
          </div>
        </DropdownPanel>}

        {showAddChecklist && <DropdownPanel title="เพิ่ม Checklist" onClose={() => setShowAddChecklist(false)}>
          <div className="flex gap-2">
            <input autoFocus value={newChecklistTitle} onChange={e => setNewChecklistTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newChecklistTitle.trim()) { store.addChecklist(card.id, newChecklistTitle.trim()); setNewChecklistTitle(''); setShowAddChecklist(false); } }}
              placeholder="ชื่อ Checklist..." className="flex-1 bg-white/10 text-sm text-white rounded px-3 py-1.5 outline-none placeholder-gray-500" />
            <button onClick={() => { if (newChecklistTitle.trim()) { store.addChecklist(card.id, newChecklistTitle.trim()); setNewChecklistTitle(''); setShowAddChecklist(false); } }}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500">เพิ่ม</button>
          </div>
        </DropdownPanel>}

        {showMembers && <DropdownPanel title="สมาชิก" onClose={() => setShowMembers(false)}>
          {store.allUsers.map((u) => {
            const memberForm: Member = { id: u.id, name: u.name, initials: u.initials, color: u.color };
            const isOnline = store.onlineUserIds.includes(u.id);
            return (
              <label key={u.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer">
                <input type="checkbox" checked={card.members.some(cm => cm.id === u.id)}
                  onChange={() => store.toggleCardMember(card.id, memberForm)} className="rounded" />
                <div className="relative">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: u.color }}>{u.initials}</div>
                  {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full ring-2 ring-[#282e33]" />}
                </div>
                <span className="text-sm text-gray-300">{u.name}</span>
                {isOnline && <span className="text-[10px] text-green-400 ml-auto">online</span>}
              </label>
            );
          })}
        </DropdownPanel>}

        {showMoveCard && <DropdownPanel title="ย้ายไปยัง List" onClose={() => setShowMoveCard(false)}>
          {board.lists.map((l: any) => (
            <button key={l.id} onClick={() => { store.moveCardToList(card.id, l.id); setShowMoveCard(false); onClose(); }}
              className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-white/10 ${l.title === listTitle ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300'}`}>
              {l.title} {l.title === listTitle && '(ปัจจุบัน)'}
            </button>
          ))}
        </DropdownPanel>}

        {showCopyCard && <DropdownPanel title="Copy card ไปยัง List" onClose={() => setShowCopyCard(false)}>
          {board.lists.map((l: any) => (
            <button key={l.id} onClick={() => { store.copyCard(card, l.id); setShowCopyCard(false); }}
              className="w-full text-left px-3 py-2 rounded text-sm text-gray-300 hover:bg-white/10">
              {l.title}
            </button>
          ))}
        </DropdownPanel>}

        <div className="grid grid-cols-[1fr_180px] gap-6">
          {/* Main */}
          <div className="space-y-5 min-w-0">
            {/* Labels */}
            {card.labels.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Labels</p>
                <div className="flex flex-wrap gap-1.5">
                  {card.labels.map(l => (
                    <span key={l.id} className="px-3 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: l.color }}>{l.name}</span>
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
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-gray-400"><Plus size={14} /></button>
                </div>
              </div>
            )}

            {/* Due date */}
            {(card.dueDate || card.startDate) && (
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-gray-400" />
                {card.startDate && <span className="text-gray-300">เริ่ม: {card.startDate}</span>}
                {card.dueDate && (
                  <span className={`px-2 py-0.5 rounded ${new Date(card.dueDate) < new Date() ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-300'}`}>
                    กำหนด: {card.dueDate}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <SectionHeader icon={<AlignLeft size={16} />} title="Description" />
              <textarea value={desc} onChange={e => setDesc(e.target.value)} onBlur={handleSaveDesc}
                placeholder="Add a more detailed description..."
                className="w-full bg-white/5 text-sm text-gray-300 rounded-lg p-3 min-h-[80px] outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-gray-500" />
            </div>

            {/* Attachments */}
            {card.attachments.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <SectionHeader icon={<Paperclip size={16} />} title={`Attachments (${card.attachments.length})`} />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-400 hover:text-white bg-white/10 px-2.5 py-1 rounded">Add</button>
                </div>
                <div className="space-y-2">
                  {card.attachments.map(att => (
                    <div key={att.id} className="flex gap-3 p-2 rounded-lg hover:bg-white/5 group">
                      <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center">
                        {isImage(att.type) ? (
                          <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-400 font-mono uppercase">{att.name.split('.').pop()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate font-medium">{att.name}</p>
                        <p className="text-xs text-gray-500">
                          Added {fmtDate(att.createdAt)}{att.size ? ` · ${fmtSize(att.size)}` : ''}
                          {att.isCover && <span className="ml-1 text-blue-400">· Cover</span>}
                        </p>
                        <div className="flex gap-3 mt-1">
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                            <ExternalLink size={11} /> Open
                          </a>
                          {isImage(att.type) && (
                            <button onClick={() => att.isCover ? store.removeCover(card.id) : store.setAttachmentAsCover(card.id, att.id, att.url)}
                              className="text-xs text-gray-400 hover:text-white">{att.isCover ? 'Remove cover' : 'Make cover'}</button>
                          )}
                          <button onClick={() => store.deleteAttachment(card.id, att.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      </div>
                    </div>
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
                  <div className="flex items-center justify-between mb-2">
                    <SectionHeader icon={<CheckSquare size={16} />} title={cl.title} />
                    <button onClick={() => { if (confirm(`ลบ checklist "${cl.title}"?`)) store.deleteChecklist(card.id, cl.id); }}
                      className="text-xs text-gray-500 hover:text-red-400 bg-white/5 px-2 py-1 rounded">Delete</button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500 w-8">{Math.round(pct)}%</span>
                    <div className="flex-1 bg-white/10 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {cl.items.map(item => (
                      <div key={item.id} className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded group/item">
                        <input type="checkbox" checked={item.completed}
                          onChange={() => store.toggleChecklistItem(card.id, cl.id, item.id)}
                          className="rounded border-gray-500 text-blue-500 bg-transparent flex-shrink-0" />
                        <span className={`text-sm flex-1 ${item.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{item.text}</span>
                        <button onClick={() => store.deleteChecklistItem(card.id, cl.id, item.id)}
                          className="text-gray-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input value={checklistInputs[cl.id] || ''}
                      onChange={e => setChecklistInputs({ ...checklistInputs, [cl.id]: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && checklistInputs[cl.id]?.trim()) {
                          store.addChecklistItem(card.id, cl.id, checklistInputs[cl.id].trim());
                          setChecklistInputs({ ...checklistInputs, [cl.id]: '' });
                        }
                      }}
                      placeholder="เพิ่มรายการ..." className="flex-1 bg-white/5 text-sm text-gray-300 rounded px-2 py-1.5 outline-none placeholder-gray-500" />
                    <button onClick={() => {
                      if (checklistInputs[cl.id]?.trim()) {
                        store.addChecklistItem(card.id, cl.id, checklistInputs[cl.id].trim());
                        setChecklistInputs({ ...checklistInputs, [cl.id]: '' });
                      }
                    }} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-500">เพิ่ม</button>
                  </div>
                </div>
              );
            })}

            {/* Comments & Activity */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionHeader icon={<MessageSquare size={16} />} title="Comments and activity" />
                <button onClick={() => setShowActivity(!showActivity)}
                  className="text-xs text-gray-400 hover:text-white">{showActivity ? 'Hide details' : 'Show details'}</button>
              </div>

              {/* Comment input */}
              <div className="mb-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <input value={commentText} onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    placeholder="Write a comment..." className="w-full bg-transparent text-sm text-gray-300 outline-none placeholder-gray-500 mb-2" />
                  {commentImage && (
                    <div className="relative inline-block mb-2">
                      <img src={commentImage} alt="" className="h-20 rounded" />
                      <button onClick={() => setCommentImage(null)} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white"><X size={12} /></button>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <input ref={commentImageRef} type="file" accept="image/*" onChange={handleCommentImageUpload} className="hidden" />
                      <button onClick={() => commentImageRef.current?.click()} className="text-gray-500 hover:text-gray-300" title="แนบรูป">
                        <Paperclip size={16} />
                      </button>
                    </div>
                    <button onClick={handleAddComment} disabled={!commentText.trim() && !commentImage}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">Save</button>
                  </div>
                </div>
              </div>

              {/* Timeline: merge comments + activities */}
              <div className="space-y-3">
                {(() => {
                  type TimelineItem = { type: 'comment'; data: typeof card.comments[0]; time: string }
                    | { type: 'activity'; data: CardActivity; time: string };

                  const items: TimelineItem[] = [
                    ...card.comments.map(c => ({ type: 'comment' as const, data: c, time: c.createdAt })),
                    ...(showActivity ? card.activities.map(a => ({ type: 'activity' as const, data: a, time: a.timestamp })) : []),
                  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

                  return items.map(item => {
                    if (item.type === 'comment') {
                      const c = item.data as typeof card.comments[0];
                      const isEditing = editingComment === c.id;
                      return (
                        <div key={`c-${c.id}`} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                            {c.authorName.slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-300">{c.authorName}</span>
                              <span className="text-xs text-gray-500">{fmtDate(c.createdAt)}</span>
                              {c.updatedAt && <span className="text-xs text-gray-600">(edited)</span>}
                            </div>
                            {isEditing ? (
                              <div>
                                <input autoFocus value={editCommentText} onChange={e => setEditCommentText(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') { store.updateComment(card.id, c.id, editCommentText); setEditingComment(null); } }}
                                  className="w-full bg-white/10 text-sm text-gray-300 rounded px-2 py-1 outline-none" />
                                <div className="flex gap-2 mt-1">
                                  <button onClick={() => { store.updateComment(card.id, c.id, editCommentText); setEditingComment(null); }}
                                    className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Save</button>
                                  <button onClick={() => setEditingComment(null)} className="text-xs text-gray-400">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="bg-white/5 rounded-lg p-2.5">
                                  {c.imageUrl && <img src={c.imageUrl} alt="" className="max-h-48 rounded mb-2" />}
                                  <p className="text-sm text-gray-400">{c.text}</p>
                                </div>
                                <div className="flex gap-3 mt-1">
                                  <button onClick={() => { setEditingComment(c.id); setEditCommentText(c.text); }}
                                    className="text-xs text-gray-500 hover:text-gray-300">Edit</button>
                                  <button onClick={() => { if (confirm('ลบ comment นี้?')) store.deleteComment(card.id, c.id); }}
                                    className="text-xs text-gray-500 hover:text-red-400">Delete</button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      const a = item.data as CardActivity;
                      return (
                        <div key={`a-${a.id}`} className="flex gap-3 items-start">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm flex-shrink-0">
                            {activityIcon(a.type)}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">
                              {a.type === 'created' && `สร้างการ์ด${a.detail ? ` — ${a.detail}` : ''}`}
                              {a.type === 'moved' && `ย้ายจาก ${a.fromListTitle} → ${a.toListTitle}`}
                              {a.type === 'completed' && `เสร็จแล้ว (${a.toListTitle})`}
                            </p>
                            <span className="text-xs text-gray-600">{fmtDate(a.timestamp)}</span>
                          </div>
                        </div>
                      );
                    }
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 font-medium mb-1">เพิ่มใน Card</p>
            <input ref={fileInputRef} type="file" multiple onChange={handleUploadAttachment} className="hidden" />

            <SideBtn icon={<Tag size={14} />} label="ป้ายกำกับ" onClick={() => setShowLabels(!showLabels)} />
            <SideBtn icon={<Users size={14} />} label="สมาชิก" onClick={() => setShowMembers(!showMembers)} />
            <SideBtn icon={<Calendar size={14} />} label="กำหนดส่ง" onClick={() => setShowDatePicker(!showDatePicker)} />
            <SideBtn icon={<CheckSquare size={14} />} label="Checklist" onClick={() => setShowAddChecklist(!showAddChecklist)} />
            <SideBtn icon={<Paperclip size={14} />} label={uploading ? 'กำลังอัพ...' : 'Attachment'} onClick={() => fileInputRef.current?.click()} />
            <SideBtn icon={<Image size={14} />} label="รูปปก" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = async (e: any) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); await store.uploadAttachment(card.id, file); setUploading(false); }; input.click(); }} />
            <SideBtn icon={card.isWatching ? <EyeOff size={14} /> : <Eye size={14} />}
              label={card.isWatching ? 'เลิกติดตาม' : 'ติดตาม'} onClick={() => store.updateCard(card.id, { isWatching: !card.isWatching })} />

            <hr className="border-white/10 my-2" />
            <p className="text-xs text-gray-500 font-medium mb-1">Actions</p>

            <SideBtn icon={<ArrowRight size={14} />} label="Move" onClick={() => setShowMoveCard(!showMoveCard)} />
            <SideBtn icon={<Copy size={14} />} label="Copy" onClick={() => setShowCopyCard(!showCopyCard)} />
            <SideBtn icon={<Archive size={14} />} label="Archive" onClick={handleArchive} />

            <hr className="border-white/10 my-2" />
            <button onClick={handleDelete} className="sidebar-btn text-red-400 hover:!bg-red-500/10 w-full">
              <Trash2 size={14} /> ลบถาวร
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">{icon} {title}</div>;
}

function DropdownPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="mb-4 bg-[#282e33] rounded-lg border border-white/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400 font-medium">{title}</p>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={14} /></button>
      </div>
      {children}
    </div>
  );
}

function QBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 text-sm rounded-lg transition-colors">
      {icon} {label}
    </button>
  );
}

function SideBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="sidebar-btn w-full">
      {icon} {label}
    </button>
  );
}
