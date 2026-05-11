import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import type { Board, Card, List, Label, Member, Checklist, ChecklistItem, Comment, CardActivity } from '@/types';

const BOARD_ID = '00000000-0000-0000-0000-000000000001';

export async function fetchBoard(): Promise<Board | null> {
  const [
    { data: board },
    { data: lists },
    { data: labels },
    { data: members },
  ] = await Promise.all([
    supabase.from('boards').select('*').eq('id', BOARD_ID).single(),
    supabase.from('lists').select('*').eq('board_id', BOARD_ID).order('position'),
    supabase.from('labels').select('*').eq('board_id', BOARD_ID),
    supabase.from('members').select('*').eq('board_id', BOARD_ID),
  ]);

  if (!board || !lists) return null;

  const listIds = lists.map((l: any) => l.id);

  const [
    { data: cards },
    { data: cardLabels },
    { data: cardMembers },
    { data: checklists },
    { data: checklistItems },
    { data: comments },
    { data: activities },
    { data: attachments },
  ] = await Promise.all([
    supabase.from('cards').select('*').in('list_id', listIds).order('position'),
    supabase.from('card_labels').select('*'),
    supabase.from('card_members').select('*'),
    supabase.from('checklists').select('*').order('position'),
    supabase.from('checklist_items').select('*').order('position'),
    supabase.from('comments').select('*').order('created_at', { ascending: false }),
    supabase.from('activities').select('*').order('timestamp', { ascending: false }),
    supabase.from('attachments').select('*').order('created_at', { ascending: false }),
  ]);

  const labelMap = new Map((labels || []).map((l: any) => [l.id, { id: l.id, name: l.name, color: l.color }]));
  const memberMap = new Map((members || []).map((m: any) => [m.id, { id: m.id, name: m.name, initials: m.initials, color: m.color, avatar: m.avatar_url }]));

  const cardChecklists = new Map<string, Checklist[]>();
  for (const cl of (checklists || [])) {
    const items = (checklistItems || []).filter((i: any) => i.checklist_id === cl.id).map((i: any) => ({
      id: i.id, text: i.text, completed: i.completed,
    }));
    const entry: Checklist = { id: cl.id, title: cl.title, items };
    const arr = cardChecklists.get(cl.card_id) || [];
    arr.push(entry);
    cardChecklists.set(cl.card_id, arr);
  }

  const builtCards: Card[] = (cards || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description || '',
    listId: c.list_id,
    position: c.position,
    dueDate: c.due_date?.split('T')[0],
    startDate: c.start_date?.split('T')[0],
    coverColor: c.cover_color,
    coverImage: c.cover_image,
    isWatching: c.is_watching,
    completedAt: c.completed_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    labels: (cardLabels || []).filter((cl: any) => cl.card_id === c.id).map((cl: any) => labelMap.get(cl.label_id)).filter(Boolean) as Label[],
    members: (cardMembers || []).filter((cm: any) => cm.card_id === c.id).map((cm: any) => memberMap.get(cm.member_id)).filter(Boolean) as Member[],
    checklists: cardChecklists.get(c.id) || [],
    comments: (comments || []).filter((cm: any) => cm.card_id === c.id).map((cm: any) => ({
      id: cm.id, text: cm.text, authorId: '', authorName: cm.author_name, createdAt: cm.created_at,
    })),
    activities: (activities || []).filter((a: any) => a.card_id === c.id).map((a: any) => ({
      id: a.id, type: a.type, fromListTitle: a.from_list_title, toListTitle: a.to_list_title, detail: a.detail, timestamp: a.timestamp,
    })),
    attachments: (attachments || []).filter((a: any) => a.card_id === c.id).map((a: any) => ({
      id: a.id, name: a.name, url: a.url, type: a.type, size: a.size, isCover: a.is_cover, createdAt: a.created_at,
    })),
  }));

  const builtLists: List[] = lists.map((l: any) => ({
    id: l.id,
    title: l.title,
    boardId: l.board_id,
    position: l.position,
    color: l.color,
    cards: builtCards.filter(c => c.listId === l.id),
  }));

  return {
    id: board.id,
    title: board.title,
    backgroundColor: board.background_color,
    lists: builtLists,
    labels: (labels || []).map((l: any) => ({ id: l.id, name: l.name, color: l.color })),
    members: (members || []).map((m: any) => ({ id: m.id, name: m.name, initials: m.initials, color: m.color })),
    createdAt: board.created_at,
  };
}

// --- Mutations ---

export async function dbAddCard(listId: string, title: string) {
  const { data: maxPos } = await supabase.from('cards').select('position').eq('list_id', listId).order('position', { ascending: false }).limit(1).single();
  const pos = (maxPos?.position ?? -1) + 1;

  const { data: card } = await supabase.from('cards').insert({ list_id: listId, title, position: pos }).select().single();
  if (card) {
    await supabase.from('activities').insert({ card_id: card.id, type: 'created' });
  }
  return card;
}

export async function dbUpdateCard(cardId: string, updates: Record<string, any>) {
  const mapped: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) mapped.title = updates.title;
  if (updates.description !== undefined) mapped.description = updates.description;
  if (updates.dueDate !== undefined) mapped.due_date = updates.dueDate || null;
  if (updates.startDate !== undefined) mapped.start_date = updates.startDate || null;
  if (updates.coverColor !== undefined) mapped.cover_color = updates.coverColor;
  if (updates.coverImage !== undefined) mapped.cover_image = updates.coverImage;
  if (updates.isWatching !== undefined) mapped.is_watching = updates.isWatching;
  if (updates.completedAt !== undefined) mapped.completed_at = updates.completedAt;

  return supabase.from('cards').update(mapped).eq('id', cardId);
}

export async function dbDeleteCard(cardId: string) {
  return supabase.from('cards').delete().eq('id', cardId);
}

export async function dbMoveCard(cardId: string, toListId: string, toIndex: number, fromListTitle?: string, toListTitle?: string) {
  await supabase.from('cards').update({ list_id: toListId, position: toIndex, updated_at: new Date().toISOString() }).eq('id', cardId);

  const type = [6, 7, 8, 9].some(p => toListTitle?.includes('เสร็จ') || toListTitle?.includes('โพส')) ? 'completed' : 'moved';

  await supabase.from('activities').insert({
    card_id: cardId, type,
    from_list_title: fromListTitle,
    to_list_title: toListTitle,
  });

  if (type === 'completed') {
    await supabase.from('cards').update({ completed_at: new Date().toISOString() }).eq('id', cardId);
  }
}

export async function dbAddList(boardId: string, title: string) {
  const { data: maxPos } = await supabase.from('lists').select('position').eq('board_id', boardId).order('position', { ascending: false }).limit(1).single();
  const pos = (maxPos?.position ?? -1) + 1;
  return supabase.from('lists').insert({ board_id: boardId, title, position: pos }).select().single();
}

export async function dbDeleteList(listId: string) {
  return supabase.from('lists').delete().eq('id', listId);
}

export async function dbAddComment(cardId: string, text: string, authorName: string) {
  return supabase.from('comments').insert({ card_id: cardId, text, author_name: authorName }).select().single();
}

export async function dbAddChecklist(cardId: string, title: string) {
  return supabase.from('checklists').insert({ card_id: cardId, title }).select().single();
}

export async function dbAddChecklistItem(checklistId: string, text: string) {
  return supabase.from('checklist_items').insert({ checklist_id: checklistId, text }).select().single();
}

export async function dbToggleChecklistItem(itemId: string, completed: boolean) {
  return supabase.from('checklist_items').update({ completed }).eq('id', itemId);
}

export async function dbToggleCardLabel(cardId: string, labelId: string, has: boolean) {
  if (has) {
    return supabase.from('card_labels').delete().eq('card_id', cardId).eq('label_id', labelId);
  }
  return supabase.from('card_labels').insert({ card_id: cardId, label_id: labelId });
}

export async function dbToggleCardMember(cardId: string, memberId: string, has: boolean) {
  if (has) {
    return supabase.from('card_members').delete().eq('card_id', cardId).eq('member_id', memberId);
  }
  return supabase.from('card_members').insert({ card_id: cardId, member_id: memberId });
}

export async function dbAddAttachment(cardId: string, name: string, url: string, type: string, size: number) {
  return supabase.from('attachments').insert({ card_id: cardId, name, url, type, size }).select().single();
}

export async function dbDeleteAttachment(id: string) {
  return supabase.from('attachments').delete().eq('id', id);
}

export async function dbSetAttachmentAsCover(cardId: string, attachmentId: string, url: string) {
  await supabase.from('attachments').update({ is_cover: false }).eq('card_id', cardId);
  await supabase.from('attachments').update({ is_cover: true }).eq('id', attachmentId);
  await supabase.from('cards').update({ cover_image: url }).eq('id', cardId);
}

export async function dbUploadFile(cardId: string, file: File): Promise<{ url: string; path: string } | null> {
  const ext = file.name.split('.').pop();
  const path = `attachments/${cardId}-${uuidv4()}.${ext}`;
  const { error } = await supabase.storage.from('card-covers').upload(path, file);
  if (error) return null;
  const { data } = supabase.storage.from('card-covers').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function dbUploadCoverImage(cardId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `covers/${cardId}-${uuidv4()}.${ext}`;
  const { error } = await supabase.storage.from('card-covers').upload(path, file);
  if (error) return null;
  const { data } = supabase.storage.from('card-covers').getPublicUrl(path);
  return data.publicUrl;
}
