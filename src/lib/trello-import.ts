/**
 * Trello JSON → TaskFlow importer
 *
 * Usage: get JSON from Trello: Board → Show menu → ... → Print and Export → Export as JSON
 *
 * Mapping:
 *   Trello list   → TaskFlow list (fuzzy match by name, or create new)
 *   Trello label  → TaskFlow label (by name, or create)
 *   Trello card   → TaskFlow card (with desc, due, pos, archived)
 *   Trello check  → TaskFlow checklist + items
 *   Trello action[type=commentCard] → TaskFlow comment
 *   Members       → SKIP (Trello member IDs don't map to TaskFlow profiles)
 *   Attachments   → SKIP (require Trello API key to download files)
 */

import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

const BOARD_ID = '00000000-0000-0000-0000-000000000001';

function guessMimeFromUrl(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase().split(/[?#]/)[0] || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml',
    pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ai: 'application/postscript', psd: 'image/vnd.adobe.photoshop',
    zip: 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(url);
}

// Trello color → TaskFlow hex
const TRELLO_COLOR_MAP: Record<string, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#a855f7',
  blue: '#3b82f6',
  sky: '#06b6d4',
  lime: '#84cc16',
  pink: '#ec4899',
  black: '#374151',
  null: '#6b7280',
};

export interface TrelloAttachment {
  id: string;
  name?: string;
  url?: string;
  bytes?: number;
  mimeType?: string;
  date?: string;
  isUpload?: boolean;
  previews?: { url: string; width: number; height: number }[];
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  pos: number;
  due?: string | null;
  dueComplete?: boolean;
  closed?: boolean;
  idLabels?: string[];
  idChecklists?: string[];
  start?: string | null;
  attachments?: TrelloAttachment[];
  idAttachmentCover?: string | null;
  cover?: { idAttachment?: string | null; color?: string | null };
}

export interface TrelloList {
  id: string;
  name: string;
  pos: number;
  closed?: boolean;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloChecklist {
  id: string;
  idCard: string;
  name: string;
  pos?: number;
  checkItems: { id: string; name: string; state: 'complete' | 'incomplete'; pos?: number }[];
}

export interface TrelloAction {
  id: string;
  type: string;
  data: {
    card?: { id: string };
    text?: string;
  };
  date: string;
  memberCreator?: { fullName?: string; username?: string };
}

export interface TrelloExport {
  name?: string;
  lists: TrelloList[];
  cards: TrelloCard[];
  labels: TrelloLabel[];
  checklists?: TrelloChecklist[];
  actions?: TrelloAction[];
}

export interface ImportResult {
  lists: { created: number; matched: number };
  labels: { created: number; matched: number };
  cards: { created: number; skipped: number; archived: number };
  checklists: number;
  checklistItems: number;
  comments: number;
  attachments: number;
  errors: string[];
}

export interface ImportProgress {
  step: string;
  current?: number;
  total?: number;
}

export async function importTrelloJSON(
  data: TrelloExport,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    lists: { created: 0, matched: 0 },
    labels: { created: 0, matched: 0 },
    cards: { created: 0, skipped: 0, archived: 0 },
    checklists: 0,
    checklistItems: 0,
    comments: 0,
    attachments: 0,
    errors: [],
  };

  // ─────────────────────────────────────────────
  // 1. LISTS — match by name (case-insensitive, ignore emoji), else create
  // ─────────────────────────────────────────────
  onProgress?.({ step: 'lists' });
  const { data: existingLists } = await supabase
    .from('lists').select('id, title, position').eq('board_id', BOARD_ID).order('position');
  const listIdMap = new Map<string, string>(); // Trello list id → TaskFlow list id

  const normalize = (s: string) => s.replace(/[\p{Emoji}\s]/gu, '').toLowerCase().trim();

  let nextPos = (existingLists?.[existingLists.length - 1]?.position ?? -1) + 1;

  for (const tList of data.lists.filter((l) => !l.closed)) {
    const match = (existingLists || []).find((el) => normalize(el.title) === normalize(tList.name));
    if (match) {
      listIdMap.set(tList.id, match.id);
      result.lists.matched++;
    } else {
      const { data: newList, error } = await supabase
        .from('lists')
        .insert({ board_id: BOARD_ID, title: tList.name, position: nextPos++ })
        .select().single();
      if (error || !newList) {
        result.errors.push(`list "${tList.name}": ${error?.message}`);
        continue;
      }
      listIdMap.set(tList.id, newList.id);
      result.lists.created++;
    }
  }

  // ─────────────────────────────────────────────
  // 2. LABELS — match by color+name
  // ─────────────────────────────────────────────
  onProgress?.({ step: 'labels' });
  const { data: existingLabels } = await supabase
    .from('labels').select('id, name, color').eq('board_id', BOARD_ID);
  const labelIdMap = new Map<string, string>(); // Trello label id → TaskFlow label id

  for (const tLabel of data.labels) {
    const color = TRELLO_COLOR_MAP[tLabel.color || 'null'] || '#6b7280';
    const name = tLabel.name || '(unnamed)';
    const match = (existingLabels || []).find(
      (el) => el.name.toLowerCase() === name.toLowerCase() && el.color === color
    );
    if (match) {
      labelIdMap.set(tLabel.id, match.id);
      result.labels.matched++;
    } else {
      const { data: newLabel, error } = await supabase
        .from('labels').insert({ board_id: BOARD_ID, name, color }).select().single();
      if (error || !newLabel) {
        result.errors.push(`label "${name}": ${error?.message}`);
        continue;
      }
      labelIdMap.set(tLabel.id, newLabel.id);
      result.labels.created++;
    }
  }

  // ─────────────────────────────────────────────
  // 3. CARDS — dedupe by trello_id (if column exists), else by title+listId
  // ─────────────────────────────────────────────
  const cards = data.cards;
  const cardIdMap = new Map<string, string>(); // Trello card id → TaskFlow card id

  // Pull existing trello_ids to skip duplicates
  const { data: existingByTrello } = await supabase
    .from('cards').select('id, trello_id').not('trello_id', 'is', null);
  const existingTrelloIds = new Set<string>();
  (existingByTrello || []).forEach((c: any) => {
    if (c.trello_id) existingTrelloIds.add(c.trello_id);
  });

  // ─────────────────────────────────────────────
  // Build all card rows + relationships client-side first, then bulk insert
  // (10-50× faster than per-row inserts for large boards)
  // ─────────────────────────────────────────────
  const cardRows: any[] = [];
  const cardLabelRows: { card_id: string; label_id: string }[] = [];
  const attachmentRows: any[] = [];
  const cardCoverUpdates: { id: string; cover_image: string }[] = [];

  for (let i = 0; i < cards.length; i++) {
    const tCard = cards[i];
    if (existingTrelloIds.has(tCard.id)) {
      result.cards.skipped++;
      continue;
    }
    const taskflowListId = listIdMap.get(tCard.idList);
    if (!taskflowListId) {
      result.cards.skipped++;
      continue;
    }

    const newCardId = uuidv4();
    const cardRow: any = {
      id: newCardId,
      list_id: taskflowListId,
      title: tCard.name || '(no title)',
      description: tCard.desc || '',
      position: tCard.pos || 0,
      due_date: tCard.due || null,
      start_date: tCard.start || null,
      archived: !!tCard.closed,
      trello_id: tCard.id,
    };
    if (tCard.cover?.color && !tCard.cover.idAttachment) {
      cardRow.cover_color = TRELLO_COLOR_MAP[tCard.cover.color] || null;
    }
    if (tCard.dueComplete && tCard.due) {
      cardRow.completed_at = tCard.due;
    }

    cardRows.push(cardRow);
    cardIdMap.set(tCard.id, newCardId);
    if (tCard.closed) result.cards.archived++;

    // Labels
    if (tCard.idLabels?.length) {
      for (const tlid of tCard.idLabels) {
        const labelId = labelIdMap.get(tlid);
        if (labelId) cardLabelRows.push({ card_id: newCardId, label_id: labelId });
      }
    }

    // Attachments
    if (tCard.attachments?.length) {
      for (const a of tCard.attachments) {
        if (!a.url) continue;
        const isCover = tCard.idAttachmentCover === a.id || tCard.cover?.idAttachment === a.id;
        const mime = a.mimeType || guessMimeFromUrl(a.url);
        attachmentRows.push({
          card_id: newCardId,
          name: a.name || a.url.split('/').pop() || 'attachment',
          url: a.url,
          type: mime,
          size: a.bytes || null,
          is_cover: isCover,
          created_at: a.date || new Date().toISOString(),
        });
        if (isCover && (mime?.startsWith('image/') || isImageUrl(a.url))) {
          cardCoverUpdates.push({ id: newCardId, cover_image: a.url });
        }
      }
    }
  }

  // Bulk insert cards in chunks of 100 (Supabase row limit safety)
  onProgress?.({ step: 'cards', current: 0, total: cardRows.length });
  for (let i = 0; i < cardRows.length; i += 100) {
    const chunk = cardRows.slice(i, i + 100);
    const { error } = await supabase.from('cards').insert(chunk);
    if (error) {
      result.errors.push(`cards batch ${i / 100 + 1}: ${error.message}`);
    } else {
      result.cards.created += chunk.length;
    }
    onProgress?.({ step: 'cards', current: Math.min(i + 100, cardRows.length), total: cardRows.length });
  }

  // Bulk insert card_labels
  if (cardLabelRows.length) {
    for (let i = 0; i < cardLabelRows.length; i += 500) {
      const chunk = cardLabelRows.slice(i, i + 500);
      const { error } = await supabase.from('card_labels').insert(chunk);
      if (error) result.errors.push(`card_labels batch: ${error.message}`);
    }
  }

  // Bulk insert attachments
  if (attachmentRows.length) {
    for (let i = 0; i < attachmentRows.length; i += 200) {
      const chunk = attachmentRows.slice(i, i + 200);
      const { error } = await supabase.from('attachments').insert(chunk);
      if (error) result.errors.push(`attachments batch: ${error.message}`);
      else result.attachments += chunk.length;
    }
  }

  // Update card covers (only those with image attachment cover)
  if (cardCoverUpdates.length) {
    // No batch update in Supabase — do these one by one but only the small subset that has cover
    for (const u of cardCoverUpdates) {
      await supabase.from('cards').update({ cover_image: u.cover_image }).eq('id', u.id);
    }
  }

  // ─────────────────────────────────────────────
  // 4. CHECKLISTS + ITEMS — bulk insert
  // ─────────────────────────────────────────────
  if (data.checklists?.length) {
    onProgress?.({ step: 'checklists' });
    const checklistRows: any[] = [];
    const itemRows: any[] = [];

    for (const tCl of data.checklists) {
      const taskflowCardId = cardIdMap.get(tCl.idCard);
      if (!taskflowCardId) continue;
      const newClId = uuidv4();
      checklistRows.push({
        id: newClId, card_id: taskflowCardId, title: tCl.name, position: tCl.pos || 0,
      });
      if (tCl.checkItems?.length) {
        tCl.checkItems.forEach((ci, idx) => {
          itemRows.push({
            checklist_id: newClId,
            text: ci.name,
            completed: ci.state === 'complete',
            position: ci.pos || idx,
          });
        });
      }
    }

    // Bulk insert checklists in chunks
    for (let i = 0; i < checklistRows.length; i += 100) {
      const chunk = checklistRows.slice(i, i + 100);
      const { error } = await supabase.from('checklists').insert(chunk);
      if (error) result.errors.push(`checklists batch: ${error.message}`);
      else result.checklists += chunk.length;
    }
    // Bulk insert items in chunks
    for (let i = 0; i < itemRows.length; i += 200) {
      const chunk = itemRows.slice(i, i + 200);
      const { error } = await supabase.from('checklist_items').insert(chunk);
      if (error) result.errors.push(`checklist items batch: ${error.message}`);
      else result.checklistItems += chunk.length;
    }
  }

  // ─────────────────────────────────────────────
  // 5. COMMENTS (from Trello actions where type=commentCard)
  // ─────────────────────────────────────────────
  if (data.actions?.length) {
    onProgress?.({ step: 'comments' });
    const comments = data.actions
      .filter((a) => a.type === 'commentCard' && a.data?.card?.id && a.data?.text)
      .map((a) => {
        const taskflowCardId = cardIdMap.get(a.data.card!.id);
        if (!taskflowCardId) return null;
        return {
          card_id: taskflowCardId,
          text: a.data.text!,
          author_name: a.memberCreator?.fullName || a.memberCreator?.username || '(unknown)',
          created_at: a.date,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Batch insert in chunks of 100
    for (let i = 0; i < comments.length; i += 100) {
      const chunk = comments.slice(i, i + 100);
      const { error } = await supabase.from('comments').insert(chunk);
      if (error) result.errors.push(`comments batch: ${error.message}`);
      else result.comments += chunk.length;
    }
  }

  onProgress?.({ step: 'done' });
  return result;
}
