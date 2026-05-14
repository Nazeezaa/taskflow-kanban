/**
 * POST /api/import/trello
 *
 * Server-side Trello JSON importer. Accepts the raw Trello export JSON in body,
 * does all bulk inserts via supabaseAdmin (service-role) — bypasses any
 * browser extension/network issues that may block direct Supabase calls.
 *
 * Auth: must be logged in (we accept Supabase JWT in Authorization header).
 *
 * Body: { json: <TrelloExport> }
 * Response: { ok: true, result: ImportResult } | { error: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // allow long imports

const BOARD_ID = '00000000-0000-0000-0000-000000000001';

const TRELLO_COLOR_MAP: Record<string, string> = {
  green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444',
  purple: '#a855f7', blue: '#3b82f6', sky: '#06b6d4', lime: '#84cc16',
  pink: '#ec4899', black: '#374151', null: '#6b7280',
};

function guessMimeFromUrl(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase().split(/[?#]/)[0] || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf',
    mp4: 'video/mp4', mov: 'video/quicktime',
  };
  return map[ext] || 'application/octet-stream';
}
function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(url);
}
function normalize(s: string): string {
  return s.replace(/[\p{Emoji}\s]/gu, '').toLowerCase().trim();
}

export async function POST(req: NextRequest) {
  // Auth check — require user to be signed in (use anon-key client to verify)
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized — missing bearer token' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const data = body?.json;
  if (!data || !Array.isArray(data.lists) || !Array.isArray(data.cards)) {
    return NextResponse.json({ error: 'body.json must be a Trello export (lists + cards)' }, { status: 400 });
  }

  const supa = supabaseAdmin();

  const result = {
    lists: { created: 0, matched: 0 },
    labels: { created: 0, matched: 0 },
    cards: { created: 0, skipped: 0, archived: 0 },
    checklists: 0,
    checklistItems: 0,
    comments: 0,
    attachments: 0,
    errors: [] as string[],
  };

  try {
    // ── 1. LISTS ──────────────────────────────
    const { data: existingLists } = await supa
      .from('lists').select('id, title, position').eq('board_id', BOARD_ID).order('position');
    const listIdMap = new Map<string, string>();
    let nextPos = (existingLists?.[existingLists.length - 1]?.position ?? -1) + 1;

    for (const tList of data.lists.filter((l: any) => !l.closed)) {
      const match = (existingLists || []).find((el: any) => normalize(el.title) === normalize(tList.name));
      if (match) {
        listIdMap.set(tList.id, match.id);
        result.lists.matched++;
      } else {
        const { data: newList, error } = await supa
          .from('lists').insert({ board_id: BOARD_ID, title: tList.name, position: nextPos++ })
          .select().single();
        if (error || !newList) {
          result.errors.push(`list "${tList.name}": ${error?.message}`);
          continue;
        }
        listIdMap.set(tList.id, newList.id);
        result.lists.created++;
      }
    }

    // ── 2. LABELS ─────────────────────────────
    const { data: existingLabels } = await supa
      .from('labels').select('id, name, color').eq('board_id', BOARD_ID);
    const labelIdMap = new Map<string, string>();
    for (const tLabel of data.labels || []) {
      const color = TRELLO_COLOR_MAP[tLabel.color || 'null'] || '#6b7280';
      const name = tLabel.name || '(unnamed)';
      const match = (existingLabels || []).find(
        (el: any) => el.name.toLowerCase() === name.toLowerCase() && el.color === color
      );
      if (match) {
        labelIdMap.set(tLabel.id, match.id);
        result.labels.matched++;
      } else {
        const { data: newLabel, error } = await supa
          .from('labels').insert({ board_id: BOARD_ID, name, color }).select().single();
        if (error || !newLabel) {
          result.errors.push(`label "${name}": ${error?.message}`);
          continue;
        }
        labelIdMap.set(tLabel.id, newLabel.id);
        result.labels.created++;
      }
    }

    // ── 3. CARDS — sort + normalize positions ──
    const { data: existingByTrello } = await supa
      .from('cards').select('id, trello_id').not('trello_id', 'is', null);
    const existingTrelloIds = new Set<string>();
    (existingByTrello || []).forEach((c: any) => { if (c.trello_id) existingTrelloIds.add(c.trello_id); });

    const sortedCards = [...data.cards].sort((a: any, b: any) => {
      if (a.idList !== b.idList) return a.idList.localeCompare(b.idList);
      return (a.pos || 0) - (b.pos || 0);
    });

    const cardRows: any[] = [];
    const cardIdMap = new Map<string, string>();
    const cardLabelRows: { card_id: string; label_id: string }[] = [];
    const attachmentRows: any[] = [];
    const cardCoverUpdates: { id: string; cover_image: string }[] = [];
    const positionPerList = new Map<string, number>();

    for (const tCard of sortedCards) {
      if (existingTrelloIds.has(tCard.id)) { result.cards.skipped++; continue; }
      const taskflowListId = listIdMap.get(tCard.idList);
      if (!taskflowListId) { result.cards.skipped++; continue; }

      const newCardId = uuidv4();
      const positionInList = positionPerList.get(taskflowListId) || 0;
      positionPerList.set(taskflowListId, positionInList + 1);

      const cardRow: any = {
        id: newCardId,
        list_id: taskflowListId,
        title: tCard.name || '(no title)',
        description: tCard.desc || '',
        position: positionInList,
        due_date: tCard.due || null,
        start_date: tCard.start || null,
        archived: !!tCard.closed,
        trello_id: tCard.id,
      };
      if (tCard.cover?.color && !tCard.cover.idAttachment) {
        cardRow.cover_color = TRELLO_COLOR_MAP[tCard.cover.color] || null;
      }
      if (tCard.dueComplete && tCard.due) cardRow.completed_at = tCard.due;

      cardRows.push(cardRow);
      cardIdMap.set(tCard.id, newCardId);
      if (tCard.closed) result.cards.archived++;

      if (tCard.idLabels?.length) {
        for (const tlid of tCard.idLabels) {
          const labelId = labelIdMap.get(tlid);
          if (labelId) cardLabelRows.push({ card_id: newCardId, label_id: labelId });
        }
      }
      if (tCard.attachments?.length) {
        for (const a of tCard.attachments) {
          if (!a.url) continue;
          const isCover = tCard.idAttachmentCover === a.id || tCard.cover?.idAttachment === a.id;
          const mime = a.mimeType || guessMimeFromUrl(a.url);
          attachmentRows.push({
            card_id: newCardId,
            name: a.name || a.url.split('/').pop() || 'attachment',
            url: a.url, type: mime, size: a.bytes || null,
            is_cover: isCover,
            created_at: a.date || new Date().toISOString(),
          });
          if (isCover && (mime?.startsWith('image/') || isImageUrl(a.url))) {
            cardCoverUpdates.push({ id: newCardId, cover_image: a.url });
          }
        }
      }
    }

    // Bulk insert cards (chunks of 100)
    for (let i = 0; i < cardRows.length; i += 100) {
      const chunk = cardRows.slice(i, i + 100);
      const { error } = await supa.from('cards').insert(chunk);
      if (error) result.errors.push(`cards batch ${i / 100 + 1}: ${error.message}`);
      else result.cards.created += chunk.length;
    }
    // Bulk insert card_labels
    for (let i = 0; i < cardLabelRows.length; i += 500) {
      const chunk = cardLabelRows.slice(i, i + 500);
      const { error } = await supa.from('card_labels').insert(chunk);
      if (error) result.errors.push(`card_labels batch: ${error.message}`);
    }
    // Bulk insert attachments
    for (let i = 0; i < attachmentRows.length; i += 200) {
      const chunk = attachmentRows.slice(i, i + 200);
      const { error } = await supa.from('attachments').insert(chunk);
      if (error) result.errors.push(`attachments batch: ${error.message}`);
      else result.attachments += chunk.length;
    }
    // Cover updates (parallel)
    if (cardCoverUpdates.length) {
      for (let i = 0; i < cardCoverUpdates.length; i += 10) {
        const chunk = cardCoverUpdates.slice(i, i + 10);
        await Promise.all(chunk.map((u) =>
          supa.from('cards').update({ cover_image: u.cover_image }).eq('id', u.id)
        ));
      }
    }

    // ── 4. CHECKLISTS + ITEMS ───────────────────
    if (data.checklists?.length) {
      const sortedChecklists = [...data.checklists].sort((a: any, b: any) => {
        if (a.idCard !== b.idCard) return a.idCard.localeCompare(b.idCard);
        return (a.pos || 0) - (b.pos || 0);
      });
      const clPosPerCard = new Map<string, number>();
      const checklistRows: any[] = [];
      const itemRows: any[] = [];

      for (const tCl of sortedChecklists) {
        const taskflowCardId = cardIdMap.get(tCl.idCard);
        if (!taskflowCardId) continue;
        const newClId = uuidv4();
        const clPos = clPosPerCard.get(taskflowCardId) || 0;
        clPosPerCard.set(taskflowCardId, clPos + 1);
        checklistRows.push({ id: newClId, card_id: taskflowCardId, title: tCl.name, position: clPos });
        if (tCl.checkItems?.length) {
          const sortedItems = [...tCl.checkItems].sort((a: any, b: any) => (a.pos || 0) - (b.pos || 0));
          sortedItems.forEach((ci: any, idx: number) => {
            itemRows.push({
              checklist_id: newClId, text: ci.name,
              completed: ci.state === 'complete', position: idx,
            });
          });
        }
      }
      for (let i = 0; i < checklistRows.length; i += 100) {
        const chunk = checklistRows.slice(i, i + 100);
        const { error } = await supa.from('checklists').insert(chunk);
        if (error) result.errors.push(`checklists batch: ${error.message}`);
        else result.checklists += chunk.length;
      }
      for (let i = 0; i < itemRows.length; i += 200) {
        const chunk = itemRows.slice(i, i + 200);
        const { error } = await supa.from('checklist_items').insert(chunk);
        if (error) result.errors.push(`checklist items: ${error.message}`);
        else result.checklistItems += chunk.length;
      }
    }

    // ── 5. COMMENTS ─────────────────────────────
    if (data.actions?.length) {
      const comments = data.actions
        .filter((a: any) => a.type === 'commentCard' && a.data?.card?.id && a.data?.text)
        .map((a: any) => {
          const taskflowCardId = cardIdMap.get(a.data.card.id);
          if (!taskflowCardId) return null;
          return {
            card_id: taskflowCardId,
            text: a.data.text,
            author_name: a.memberCreator?.fullName || a.memberCreator?.username || '(unknown)',
            created_at: a.date,
          };
        })
        .filter((x: any): x is NonNullable<typeof x> => x !== null);

      for (let i = 0; i < comments.length; i += 100) {
        const chunk = comments.slice(i, i + 100);
        const { error } = await supa.from('comments').insert(chunk);
        if (error) result.errors.push(`comments batch: ${error.message}`);
        else result.comments += chunk.length;
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'unknown error', result }, { status: 500 });
  }
}
