import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import type { Board, Card, List, Label, Member, Checklist, ChecklistItem, Comment, CardActivity } from '@/types';

const BOARD_ID = '00000000-0000-0000-0000-000000000001';

// Helper: never throw on optional table errors — return [] so missing tables don't break the board
async function safeSelect<T = any>(query: any): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn('[fetchBoard] query error:', error.message);
      return [];
    }
    return (data || []) as T[];
  } catch (e) {
    console.warn('[fetchBoard] query threw:', e);
    return [];
  }
}

export async function fetchBoard(): Promise<Board | null> {
  // Core tables — needed to render anything
  const [boardRes, listsRes, labelsRes, membersRes] = await Promise.all([
    supabase.from('boards').select('*').eq('id', BOARD_ID).maybeSingle(),
    supabase.from('lists').select('*').eq('board_id', BOARD_ID).order('position'),
    supabase.from('labels').select('*').eq('board_id', BOARD_ID),
    supabase.from('members').select('*').eq('board_id', BOARD_ID),
  ]);

  const board = boardRes.data;
  const lists = listsRes.data;
  const labels = labelsRes.data;
  const members = membersRes.data;

  if (boardRes.error) console.error('[fetchBoard] boards error:', boardRes.error.message);
  if (listsRes.error) console.error('[fetchBoard] lists error:', listsRes.error.message);

  if (!board || !lists) return null;

  const listIds = lists.map((l: any) => l.id);

  // Use safeSelect for optional tables (attachments may not exist, etc.)
  const [cards, cardLabels, cardMembers, checklists, checklistItems, comments, activities, attachments] = await Promise.all([
    safeSelect(supabase.from('cards').select('*').in('list_id', listIds).order('position')),
    safeSelect(supabase.from('card_labels').select('*')),
    safeSelect(supabase.from('card_members').select('*')),
    safeSelect(supabase.from('checklists').select('*').order('position')),
    safeSelect(supabase.from('checklist_items').select('*').order('position')),
    safeSelect(supabase.from('comments').select('*').order('created_at', { ascending: true })),
    safeSelect(supabase.from('activities').select('*').order('timestamp', { ascending: true })),
    safeSelect(supabase.from('attachments').select('*').order('created_at', { ascending: false })),
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

  // Include archived cards too — the UI decides whether to show them (boardStore.showArchived)
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
    archived: c.archived || false,
    completedAt: c.completed_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    labels: (cardLabels || []).filter((cl: any) => cl.card_id === c.id).map((cl: any) => labelMap.get(cl.label_id)).filter(Boolean) as Label[],
    members: (cardMembers || []).filter((cm: any) => cm.card_id === c.id).map((cm: any) => memberMap.get(cm.member_id)).filter(Boolean) as Member[],
    checklists: cardChecklists.get(c.id) || [],
    comments: (comments || []).filter((cm: any) => cm.card_id === c.id).map((cm: any) => ({
      id: cm.id, text: cm.text, authorId: '', authorName: cm.author_name,
      imageUrl: cm.image_url, createdAt: cm.created_at, updatedAt: cm.updated_at,
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

// --- Card CRUD ---

export async function dbAddCard(listId: string, title: string) {
  const { data: maxPos } = await supabase.from('cards').select('position').eq('list_id', listId).order('position', { ascending: false }).limit(1).maybeSingle();
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
  if (updates.coverImage !== undefined) mapped.cover_image = updates.coverImage || null;
  if (updates.isWatching !== undefined) mapped.is_watching = updates.isWatching;
  if (updates.completedAt !== undefined) mapped.completed_at = updates.completedAt;
  if (updates.archived !== undefined) mapped.archived = updates.archived;
  return supabase.from('cards').update(mapped).eq('id', cardId);
}

export async function dbDeleteCard(cardId: string) {
  return supabase.from('cards').delete().eq('id', cardId);
}

export async function dbArchiveCard(cardId: string) {
  return supabase.from('cards').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', cardId);
}

export async function dbCopyCard(card: Card, toListId: string) {
  const { data: maxPos } = await supabase.from('cards').select('position').eq('list_id', toListId).order('position', { ascending: false }).limit(1).maybeSingle();
  const pos = (maxPos?.position ?? -1) + 1;
  const { data: newCard } = await supabase.from('cards').insert({
    list_id: toListId, title: card.title + ' (copy)', description: card.description,
    position: pos, due_date: card.dueDate || null, start_date: card.startDate || null,
    cover_color: card.coverColor, cover_image: card.coverImage,
  }).select().single();
  if (newCard) {
    for (const l of card.labels) {
      await supabase.from('card_labels').insert({ card_id: newCard.id, label_id: l.id });
    }
    for (const m of card.members) {
      await supabase.from('card_members').insert({ card_id: newCard.id, member_id: m.id });
    }
    for (const cl of card.checklists) {
      const { data: newCl } = await supabase.from('checklists').insert({ card_id: newCard.id, title: cl.title }).select().single();
      if (newCl) {
        for (const item of cl.items) {
          await supabase.from('checklist_items').insert({ checklist_id: newCl.id, text: item.text, completed: item.completed });
        }
      }
    }
    await supabase.from('activities').insert({ card_id: newCard.id, type: 'created', detail: 'Copied card' });
  }
  return newCard;
}

export async function dbMoveCardToList(cardId: string, toListId: string, fromListTitle: string, toListTitle: string) {
  const { data: maxPos } = await supabase.from('cards').select('position').eq('list_id', toListId).order('position', { ascending: false }).limit(1).maybeSingle();
  const pos = (maxPos?.position ?? -1) + 1;
  await supabase.from('cards').update({ list_id: toListId, position: pos, updated_at: new Date().toISOString() }).eq('id', cardId);
  const isComplete = toListTitle.includes('เสร็จ') || toListTitle.includes('โพส');
  await supabase.from('activities').insert({
    card_id: cardId, type: isComplete ? 'completed' : 'moved',
    from_list_title: fromListTitle, to_list_title: toListTitle,
  });
  if (isComplete) {
    await supabase.from('cards').update({ completed_at: new Date().toISOString() }).eq('id', cardId);
  }
}

export async function dbMoveCard(cardId: string, toListId: string, toIndex: number, fromListTitle?: string, toListTitle?: string) {
  await supabase.from('cards').update({ list_id: toListId, position: toIndex, updated_at: new Date().toISOString() }).eq('id', cardId);
  const isComplete = toListTitle?.includes('เสร็จ') || toListTitle?.includes('โพส');
  await supabase.from('activities').insert({
    card_id: cardId, type: isComplete ? 'completed' : 'moved',
    from_list_title: fromListTitle, to_list_title: toListTitle,
  });
  if (isComplete) {
    await supabase.from('cards').update({ completed_at: new Date().toISOString() }).eq('id', cardId);
  }
}

// --- Lists ---

export async function dbAddList(boardId: string, title: string) {
  const { data: maxPos } = await supabase.from('lists').select('position').eq('board_id', boardId).order('position', { ascending: false }).limit(1).maybeSingle();
  const pos = (maxPos?.position ?? -1) + 1;
  return supabase.from('lists').insert({ board_id: boardId, title, position: pos }).select().single();
}

export async function dbDeleteList(listId: string) {
  return supabase.from('lists').delete().eq('id', listId);
}

// --- Comments ---

export async function dbAddComment(cardId: string, text: string, authorName: string, imageUrl?: string) {
  return supabase.from('comments').insert({
    card_id: cardId, text, author_name: authorName, image_url: imageUrl || null,
  }).select().single();
}

export async function dbUpdateComment(commentId: string, text: string) {
  return supabase.from('comments').update({ text, updated_at: new Date().toISOString() }).eq('id', commentId);
}

export async function dbDeleteComment(commentId: string) {
  return supabase.from('comments').delete().eq('id', commentId);
}

// --- Checklists ---

export async function dbAddChecklist(cardId: string, title: string) {
  return supabase.from('checklists').insert({ card_id: cardId, title }).select().single();
}

export async function dbDeleteChecklist(checklistId: string) {
  return supabase.from('checklists').delete().eq('id', checklistId);
}

export async function dbAddChecklistItem(checklistId: string, text: string) {
  return supabase.from('checklist_items').insert({ checklist_id: checklistId, text }).select().single();
}

export async function dbToggleChecklistItem(itemId: string, completed: boolean) {
  return supabase.from('checklist_items').update({ completed }).eq('id', itemId);
}

export async function dbDeleteChecklistItem(itemId: string) {
  return supabase.from('checklist_items').delete().eq('id', itemId);
}

// --- Labels & Members ---

export async function dbToggleCardLabel(cardId: string, labelId: string, has: boolean) {
  if (has) return supabase.from('card_labels').delete().eq('card_id', cardId).eq('label_id', labelId);
  return supabase.from('card_labels').insert({ card_id: cardId, label_id: labelId });
}

export async function dbToggleCardMember(cardId: string, memberId: string, has: boolean) {
  if (has) return supabase.from('card_members').delete().eq('card_id', cardId).eq('member_id', memberId);
  return supabase.from('card_members').insert({ card_id: cardId, member_id: memberId });
}

// --- Attachments ---

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

export async function dbRemoveCover(cardId: string) {
  await supabase.from('attachments').update({ is_cover: false }).eq('card_id', cardId);
  await supabase.from('cards').update({ cover_image: null }).eq('id', cardId);
}

// --- File Upload ---

export async function dbUploadFile(cardId: string, file: File): Promise<{ url: string; path: string } | null> {
  const ext = file.name.split('.').pop();
  const path = `attachments/${cardId}-${uuidv4()}.${ext}`;
  const { error } = await supabase.storage.from('card-covers').upload(path, file);
  if (error) return null;
  const { data } = supabase.storage.from('card-covers').getPublicUrl(path);
  return { url: data.publicUrl, path };
}
