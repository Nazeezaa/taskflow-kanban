/**
 * Trello REST API client + KPI normalizer
 *
 * Auth: TRELLO_API_KEY + TRELLO_TOKEN (server env vars only)
 * Board: TRELLO_BOARD_ID
 *
 * Strategy: pull lists/cards/members/actions on-demand, cache 10 min server-side.
 * Trello rate limit: 300 req / 10 sec / token — well within for a single board pull.
 */

interface TrelloList { id: string; name: string; closed: boolean; pos: number }
interface TrelloMember { id: string; fullName: string; username: string; }
interface TrelloLabel { id: string; name: string; color: string | null }
interface TrelloCard {
  id: string; name: string; idList: string; idLabels: string[]; idMembers: string[];
  closed: boolean; due: string | null; dueComplete: boolean; start: string | null;
  dateLastActivity: string;
  shortUrl?: string;
}
interface TrelloAction {
  id: string; type: string; date: string;
  data: {
    card?: { id: string };
    listBefore?: { id: string; name: string };
    listAfter?: { id: string; name: string };
    list?: { id: string; name: string };
  };
  memberCreator?: { id: string; fullName: string; username: string };
}

export interface TrelloBoardSnapshot {
  fetchedAt: string;
  board: { id: string; name: string };
  lists: TrelloList[];
  members: TrelloMember[];
  labels: TrelloLabel[];
  cards: TrelloCard[];
  actions: TrelloAction[];
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
let _cache: { snap: TrelloBoardSnapshot; expiresAt: number } | null = null;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function trello<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const u = new URL(`https://api.trello.com/1${path}`);
  u.searchParams.set('key', env('TRELLO_API_KEY'));
  u.searchParams.set('token', env('TRELLO_TOKEN'));
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`Trello ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function fetchTrelloBoardSnapshot(force = false): Promise<TrelloBoardSnapshot> {
  if (!force && _cache && _cache.expiresAt > Date.now()) return _cache.snap;

  const boardId = env('TRELLO_BOARD_ID');
  // Parallel fetch all resources we need
  const [board, lists, members, labels, cards, actions] = await Promise.all([
    trello<any>(`/boards/${boardId}`, { fields: 'name' }),
    trello<TrelloList[]>(`/boards/${boardId}/lists`, { fields: 'name,closed,pos', filter: 'open' }),
    trello<TrelloMember[]>(`/boards/${boardId}/members`, { fields: 'fullName,username' }),
    trello<TrelloLabel[]>(`/boards/${boardId}/labels`, { fields: 'name,color' }),
    trello<TrelloCard[]>(`/boards/${boardId}/cards`, {
      fields: 'name,idList,idLabels,idMembers,closed,due,dueComplete,start,dateLastActivity,shortUrl',
      filter: 'all',
    }),
    // Pull last 1000 actions — enough for monthly KPI; filter to relevant types
    trello<TrelloAction[]>(`/boards/${boardId}/actions`, {
      filter: 'updateCard,createCard,commentCard',
      limit: '1000',
    }),
  ]);

  const snap: TrelloBoardSnapshot = {
    fetchedAt: new Date().toISOString(),
    board: { id: board.id, name: board.name },
    lists, members, labels, cards, actions,
  };
  _cache = { snap, expiresAt: Date.now() + CACHE_TTL_MS };
  return snap;
}

// Convenience to invalidate cache
export function invalidateTrelloCache() {
  _cache = null;
}

// ─────────────────────────────────────────────────────────────────
// KPI computation
// ─────────────────────────────────────────────────────────────────

const DONE_LIST_HINTS = ['เสร็จ', 'โพส', 'done', 'complete'];

function isDoneList(list: TrelloList | undefined | null): boolean {
  if (!list) return false;
  const n = list.name.toLowerCase();
  return DONE_LIST_HINTS.some((h) => n.includes(h));
}

/**
 * Compute "completed_at" for each card: the timestamp when card was moved
 * to a done-like list. Returns Map<cardId, completedAt|null>.
 */
function computeCompletionTimes(
  cards: TrelloCard[],
  lists: TrelloList[],
  actions: TrelloAction[]
): Map<string, string | null> {
  const listById = new Map(lists.map((l) => [l.id, l]));
  const result = new Map<string, string | null>();

  for (const card of cards) {
    // Find latest move TO a done list
    const moveActions = actions
      .filter((a) => a.type === 'updateCard' && a.data?.card?.id === card.id && a.data.listAfter)
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first

    let completedAt: string | null = null;
    for (const a of moveActions) {
      const target = a.data.listAfter ? listById.get(a.data.listAfter.id) : null;
      if (isDoneList(target)) {
        completedAt = a.date;
        break;
      }
    }

    // Also: if the card is currently in a done list (no move action found), use last activity
    if (!completedAt) {
      const currentList = listById.get(card.idList);
      if (isDoneList(currentList)) {
        completedAt = card.dateLastActivity || null;
      }
    }

    // Fallback: if dueComplete and due is set
    if (!completedAt && card.dueComplete && card.due) {
      completedAt = card.due;
    }

    result.set(card.id, completedAt);
  }

  return result;
}

/**
 * Compute "created_at" for each card from createCard actions
 */
function computeCreationTimes(cards: TrelloCard[], actions: TrelloAction[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const a of actions) {
    if (a.type === 'createCard' && a.data?.card?.id) {
      // Earliest createCard wins (in case of duplicates)
      const existing = result.get(a.data.card.id);
      if (!existing || a.date < existing) result.set(a.data.card.id, a.date);
    }
  }
  // For cards without createCard action (older than action history), use dateLastActivity as proxy
  for (const c of cards) {
    if (!result.has(c.id)) result.set(c.id, c.dateLastActivity);
  }
  return result;
}

export type PeriodKey = 'week' | 'month' | 'quarter' | 'year' | 'all';

export interface KpiSummary {
  fetchedAt: string;
  period: { key: PeriodKey; label: string; start: string; end: string };
  overall: {
    totalCards: number;
    activeCards: number;
    completedCards: number;       // in period
    completedThisMonth: number;
    completedThisWeek: number;
    onTimeRate: number;
    onTimePct: number;
    avgCycleTimeDays: number;
  };
  byDesigner: {
    id: string;
    name: string;
    username: string;
    cardsAssigned: number;
    cardsCompleted: number;
    cardsCompletedThisMonth: number;
    onTimeRate: number;
    avgCycleTimeDays: number;
  }[];
  byList: { id: string; name: string; count: number; activeCount: number }[];
  byLabel: { id: string; name: string; color: string; count: number }[];
  throughput: { weekStart: string; completed: number }[];
  /** Cards stuck > 7 days in current list (excluding done lists) */
  bottlenecks: {
    cardId: string;
    cardName: string;
    listName: string;
    daysStuck: number;
    members: string[];
    url?: string;
  }[];
}

export interface HrDesignerKpi {
  designer: { id: string; name: string; lineUserId: string | null };
  cardsCompleted: number;
  onTimeRate: number;
  revisionAvg: number;
  brandFitScore: number | null;
  contentPerformance: null;
}

function resolvePeriod(key: PeriodKey): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = new Date(now);
  let start: Date;
  let label: string;
  switch (key) {
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      label = 'สัปดาห์นี้';
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      label = 'เดือนนี้';
      break;
    case 'quarter':
      start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      label = '3 เดือนล่าสุด';
      break;
    case 'year':
      start = new Date(now);
      start.setFullYear(now.getFullYear() - 1);
      label = '1 ปีล่าสุด';
      break;
    case 'all':
    default:
      start = new Date(0);
      label = 'ทั้งหมด';
      break;
  }
  return { start, end, label };
}

/**
 * Read TRELLO_DESIGNER_USERNAMES env (comma-separated usernames).
 * If set, KPI counts ONLY cards assigned to those usernames.
 * If empty/unset, counts all board members (legacy behaviour).
 */
function getDesignerAllowlist(): Set<string> | null {
  const raw = process.env.TRELLO_DESIGNER_USERNAMES;
  if (!raw) return null;
  return new Set(raw.split(',').map((u) => u.trim().toLowerCase()).filter(Boolean));
}

function isDesigner(allowlist: Set<string> | null, member: { username: string; fullName: string }): boolean {
  if (!allowlist) return true;
  return allowlist.has(member.username.toLowerCase()) ||
    allowlist.has(member.fullName.toLowerCase());
}

export function computeKpi(snap: TrelloBoardSnapshot, opts?: { period?: PeriodKey }): KpiSummary {
  const { lists, members, labels, cards, actions } = snap;
  const completionTimes = computeCompletionTimes(cards, lists, actions);
  const creationTimes = computeCreationTimes(cards, actions);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const listById = new Map(lists.map((l) => [l.id, l]));
  const labelById = new Map(labels.map((l) => [l.id, l]));

  const periodKey: PeriodKey = opts?.period || 'month';
  const period = resolvePeriod(periodKey);

  const designerAllowlist = getDesignerAllowlist();

  // A card "counts" for KPI only if at least one assigned member is in the allowlist.
  // If no allowlist set, every card counts (legacy behaviour).
  const cardCountsForKpi = (card: TrelloCard): boolean => {
    if (!designerAllowlist) return true;
    for (const mid of card.idMembers || []) {
      const m = memberById.get(mid);
      if (m && isDesigner(designerAllowlist, m)) return true;
    }
    return false;
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const isInRange = (iso: string | null | undefined, from: Date, to?: Date) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= from.getTime() && (!to || t <= to.getTime());
  };

  let completedCount = 0;
  let onTimeCount = 0;
  let cycleSum = 0;
  let cycleN = 0;
  const completedThisMonth: TrelloCard[] = [];
  const completedThisWeek: TrelloCard[] = [];

  for (const card of cards) {
    if (card.closed) continue;
    if (!cardCountsForKpi(card)) continue; // skip cards not assigned to any designer
    const completedAt = completionTimes.get(card.id);
    if (!completedAt) continue;
    const inPeriod = isInRange(completedAt, period.start, period.end);
    if (inPeriod) {
      completedCount++;
      if (card.due) {
        if (new Date(completedAt) <= new Date(card.due)) onTimeCount++;
      }
      const createdAt = creationTimes.get(card.id);
      if (createdAt) {
        const days = (new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 86400000;
        if (days >= 0 && days < 365) { cycleSum += days; cycleN++; }
      }
    }
    if (isInRange(completedAt, monthStart)) completedThisMonth.push(card);
    if (isInRange(completedAt, weekStart)) completedThisWeek.push(card);
  }

  // Per-designer
  const byDesignerMap = new Map<string, {
    id: string; name: string; username: string;
    assigned: number; completed: number; completedThisMonth: number;
    onTime: number; withDue: number; cycleSum: number; cycleN: number;
  }>();
  for (const card of cards) {
    if (card.closed) continue;
    const completedAt = completionTimes.get(card.id) || null;
    const createdAt = creationTimes.get(card.id);
    for (const mid of card.idMembers || []) {
      const m = memberById.get(mid);
      if (!m) continue;
      if (!isDesigner(designerAllowlist, m)) continue; // skip non-designers
      let agg = byDesignerMap.get(mid);
      if (!agg) {
        agg = { id: mid, name: m.fullName, username: m.username,
          assigned: 0, completed: 0, completedThisMonth: 0,
          onTime: 0, withDue: 0, cycleSum: 0, cycleN: 0 };
        byDesignerMap.set(mid, agg);
      }
      agg.assigned++;
      if (completedAt) {
        agg.completed++;
        if (isInRange(completedAt, monthStart)) agg.completedThisMonth++;
        if (card.due) {
          agg.withDue++;
          if (new Date(completedAt) <= new Date(card.due)) agg.onTime++;
        }
        if (createdAt) {
          const days = (new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 86400000;
          if (days >= 0 && days < 365) { agg.cycleSum += days; agg.cycleN++; }
        }
      }
    }
  }
  const byDesigner = Array.from(byDesignerMap.values())
    .map((d) => ({
      id: d.id, name: d.name, username: d.username,
      cardsAssigned: d.assigned,
      cardsCompleted: d.completed,
      cardsCompletedThisMonth: d.completedThisMonth,
      onTimeRate: d.withDue > 0 ? d.onTime / d.withDue : 0,
      avgCycleTimeDays: d.cycleN > 0 ? d.cycleSum / d.cycleN : 0,
    }))
    .sort((a, b) => b.cardsCompletedThisMonth - a.cardsCompletedThisMonth);

  // Per-list (scoped to designer if allowlist set)
  const byListMap = new Map<string, { id: string; name: string; count: number; active: number }>();
  for (const list of lists) {
    byListMap.set(list.id, { id: list.id, name: list.name, count: 0, active: 0 });
  }
  for (const card of cards) {
    if (!cardCountsForKpi(card)) continue;
    const e = byListMap.get(card.idList);
    if (!e) continue;
    e.count++;
    if (!card.closed) e.active++;
  }
  const byList = Array.from(byListMap.values())
    .map((e) => ({ id: e.id, name: e.name, count: e.count, activeCount: e.active }));

  // Per-label
  const byLabelMap = new Map<string, { id: string; name: string; color: string; count: number }>();
  for (const card of cards) {
    if (card.closed) continue;
    for (const lid of card.idLabels || []) {
      const lab = labelById.get(lid);
      if (!lab) continue;
      let e = byLabelMap.get(lid);
      if (!e) {
        e = { id: lid, name: lab.name || '(unnamed)', color: lab.color || 'gray', count: 0 };
        byLabelMap.set(lid, e);
      }
      e.count++;
    }
  }
  const byLabel = Array.from(byLabelMap.values()).sort((a, b) => b.count - a.count);

  // Throughput — last 12 weeks
  const throughput: { weekStart: string; completed: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(weekStart);
    start.setDate(weekStart.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    let n = 0;
    for (const card of cards) {
      if (card.closed) continue;
      if (!cardCountsForKpi(card)) continue;
      const ct = completionTimes.get(card.id);
      if (ct && isInRange(ct, start, end)) n++;
    }
    throughput.push({ weekStart: start.toISOString().slice(0, 10), completed: n });
  }

  // Bottleneck: cards stuck in current (non-done) list > 7 days
  // "stuck" = no listAfter action for this card since N days ago, OR creation > N days ago for cards never moved
  const bottlenecks: KpiSummary['bottlenecks'] = [];
  const moveByCard = new Map<string, string>(); // cardId → latest move-IN date
  for (const a of actions) {
    if (a.type === 'updateCard' && a.data?.card?.id && a.data.listAfter) {
      const prev = moveByCard.get(a.data.card.id);
      if (!prev || a.date > prev) moveByCard.set(a.data.card.id, a.date);
    }
  }
  for (const card of cards) {
    if (card.closed) continue;
    if (!cardCountsForKpi(card)) continue; // only show designer's stuck cards
    const currentList = listById.get(card.idList);
    if (!currentList || isDoneList(currentList)) continue;
    const movedAt = moveByCard.get(card.id) || creationTimes.get(card.id);
    if (!movedAt) continue;
    const daysStuck = Math.floor((Date.now() - new Date(movedAt).getTime()) / 86400000);
    if (daysStuck > 7) {
      bottlenecks.push({
        cardId: card.id,
        cardName: card.name,
        listName: currentList.name,
        daysStuck,
        members: (card.idMembers || []).map((mid) => memberById.get(mid)?.fullName).filter(Boolean) as string[],
        url: card.shortUrl,
      });
    }
  }
  bottlenecks.sort((a, b) => b.daysStuck - a.daysStuck);

  // Total / active counts — also scoped to designer if allowlist is set
  const scopedCards = designerAllowlist ? cards.filter(cardCountsForKpi) : cards;

  return {
    fetchedAt: snap.fetchedAt,
    period: {
      key: periodKey,
      label: period.label,
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    overall: {
      totalCards: scopedCards.length,
      activeCards: scopedCards.filter((c) => !c.closed).length,
      completedCards: completedCount,
      completedThisMonth: completedThisMonth.length,
      completedThisWeek: completedThisWeek.length,
      onTimeRate: completedCount > 0 ? onTimeCount / completedCount : 0,
      onTimePct: completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 0,
      avgCycleTimeDays: cycleN > 0 ? Math.round((cycleSum / cycleN) * 10) / 10 : 0,
    },
    byDesigner, byList, byLabel, throughput, bottlenecks,
  };
}

/**
 * KPI for HR pull — matches INTEGRATION-graphic.md shape.
 * Period filter applied here.
 */
export function computeHrKpi(snap: TrelloBoardSnapshot, period: { start: Date; end: Date }, lineUserIdMap: Map<string, string>) {
  const { lists, members, cards, actions } = snap;
  const completionTimes = computeCompletionTimes(cards, lists, actions);
  const memberById = new Map(members.map((m) => [m.id, m]));

  const isInRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= period.start.getTime() && t <= period.end.getTime();
  };

  // Group completed cards by designer in period
  const designerMap = new Map<string, {
    designer: { id: string; name: string; lineUserId: string | null };
    cards: TrelloCard[];
  }>();

  for (const card of cards) {
    if (card.closed) continue;
    const completedAt = completionTimes.get(card.id);
    if (!completedAt || !isInRange(completedAt)) continue;
    for (const mid of card.idMembers || []) {
      const m = memberById.get(mid);
      if (!m) continue;
      const lineUserId = lineUserIdMap.get(m.username) || lineUserIdMap.get(m.id) || null;
      if (!designerMap.has(mid)) {
        designerMap.set(mid, {
          designer: { id: m.id, name: m.fullName, lineUserId },
          cards: [],
        });
      }
      designerMap.get(mid)!.cards.push(card);
    }
  }

  const byDesigner: HrDesignerKpi[] = [];
  let totalCards = 0;
  let totalOnTime = 0;
  let totalWithDue = 0;
  const designersWithCards = new Set<string>();

  for (const [, d] of designerMap) {
    // Spec: skip designers without line_user_id
    if (!d.designer.lineUserId) {
      console.warn(`[kpi] designer ${d.designer.name} (${d.designer.id}) has no line_user_id — skipped`);
      continue;
    }
    const cs = d.cards;
    const total = cs.length;
    const withDue = cs.filter((c) => c.due);
    const onTime = withDue.filter((c) => {
      const ct = completionTimes.get(c.id);
      return ct && c.due && new Date(ct) <= new Date(c.due);
    }).length;
    totalCards += total;
    totalOnTime += onTime;
    totalWithDue += withDue.length;
    designersWithCards.add(d.designer.id);

    byDesigner.push({
      designer: d.designer as any,
      cardsCompleted: total,
      onTimeRate: withDue.length > 0 ? Math.round((onTime / withDue.length) * 1000) / 1000 : 0,
      revisionAvg: 0, // Trello doesn't track revisions — would need custom field
      brandFitScore: null, // Same
      contentPerformance: null,
    });
  }

  byDesigner.sort((a, b) => b.cardsCompleted - a.cardsCompleted);

  return {
    overall: {
      totalCards,
      totalDesigners: designersWithCards.size,
      avgRevisionsPerCard: 0,
      onTimePct: totalWithDue > 0 ? Math.round((totalOnTime / totalWithDue) * 100) : 0,
    },
    byDesigner,
  };
}
