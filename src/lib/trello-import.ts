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

const BOARD_ID = '00000000-0000-0000-0000-000000000001';

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
  cards: { created: number; skipped: number };
  checklists: number;
  checklistItems: number;
  comments: number;
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
    cards: { created: 0, skipped: 0 },
    checklists: 0,
    checklistItems: 0,
    comments: 0,
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

  for (let i = 0; i < cards.length; i++) {
    const tCard = cards[i];
    onProgress?.({ step: 'cards', current: i + 1, total: cards.length });

    if (existingTrelloIds.has(tCard.id)) {
      result.cards.skipped++;
      continue;
    }

    const taskflowListId = listIdMap.get(tCard.idList);
    if (!taskflowListId) {
      // List was closed in Trello → skip this card
      result.cards.skipped++;
      continue;
    }

    const cardInsert: any = {
      list_id: taskflowListId,
      title: tCard.name || '(no title)',
      description: tCard.desc || '',
      position: tCard.pos || 0,
      due_date: tCard.due || null,
      start_date: tCard.start || null,
      archived: !!tCard.closed,
      trello_id: tCard.id,
    };

    if (tCard.dueComplete && tCard.due) {
      cardInsert.completed_at = tCard.due;
    }

    const { data: newCard, error } = await supabase
      .from('cards').insert(cardInsert).select().single();

    if (error || !newCard) {
      result.errors.push(`card "${tCard.name}": ${error?.message || 'unknown'}`);
      continue;
    }

    cardIdMap.set(tCard.id, newCard.id);
    result.cards.created++;

    // Card labels
    if (tCard.idLabels?.length) {
      const labelLinks = tCard.idLabels
        .map((tlid) => labelIdMap.get(tlid))
        .filter(Boolean)
        .map((labelId) => ({ card_id: newCard.id, label_id: labelId as string }));
      if (labelLinks.length) {
        await supabase.from('card_labels').insert(labelLinks);
      }
    }
  }

  // ─────────────────────────────────────────────
  // 4. CHECKLISTS + ITEMS
  // ─────────────────────────────────────────────
  if (data.checklists?.length) {
    onProgress?.({ step: 'checklists' });
    for (const tCl of data.checklists) {
      const taskflowCardId = cardIdMap.get(tCl.idCard);
      if (!taskflowCardId) continue;
      const { data: newCl, error } = await supabase
        .from('checklists')
        .insert({ card_id: taskflowCardId, title: tCl.name, position: tCl.pos || 0 })
        .select().single();
      if (error || !newCl) {
        result.errors.push(`checklist "${tCl.name}": ${error?.message}`);
        continue;
      }
      result.checklists++;

      if (tCl.checkItems?.length) {
        const items = tCl.checkItems.map((ci, idx) => ({
          checklist_id: newCl.id,
          text: ci.name,
          completed: ci.state === 'complete',
          position: ci.pos || idx,
        }));
        const { error: itemErr } = await supabase.from('checklist_items').insert(items);
        if (itemErr) result.errors.push(`checklist items: ${itemErr.message}`);
        else result.checklistItems += items.length;
      }
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
