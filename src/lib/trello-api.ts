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
      fields: 'name,idList,idLabels,idMembers,closed,due,dueComplete,start,dateLastActivity',
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

export interface KpiSummary {
  fetchedAt: string;
  period?: { start: string; end: string; label: string };
  overall: {
    totalCards: number;
    activeCards: number;
    completedCards: number;
    completedThisMonth: number;
    completedThisWeek: number;
    onTimeRate: number;       // 0-1, completed ≤ due
    onTimePct: number;        // 0-100
    avgCycleTimeDays: number; // creation → done
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
  // For HR
  monthlyByDesigner?: HrDesignerKpi[];
}

export interface HrDesignerKpi {
  designer: { id: string; name: string; lineUserId: string | null };
  cardsCompleted: number;
  onTimeRate: number;
  revisionAvg: number;
  brandFitScore: number | null;
  contentPerformance: null;
}

export function computeKpi(snap: TrelloBoardSnapshot, opts?: { period?: { start: Date; end: Date } }): KpiSummary {
  const { lists, members, labels, cards, actions } = snap;
  const completionTimes = computeCompletionTimes(cards, lists, actions);
  const creationTimes = computeCreationTimes(cards, actions);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const listById = new Map(lists.map((l) => [l.id, l]));
  const labelById = new Map(labels.map((l) => [l.id, l]));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday
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
    if (card.closed) continue; // archived in Trello
    const completedAt = completionTimes.get(card.id);
    if (!completedAt) continue;
    completedCount++;
    // On-time
    if (card.due) {
      if (new Date(completedAt) <= new Date(card.due)) onTimeCount++;
    }
    // Cycle time
    const createdAt = creationTimes.get(card.id);
    if (createdAt) {
      const days = (new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 86400000;
      if (days >= 0 && days < 365) {
        cycleSum += days;
        cycleN++;
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

  // Per-list
  const byListMap = new Map<string, { id: string; name: string; count: number; active: number }>();
  for (const list of lists) {
    byListMap.set(list.id, { id: list.id, name: list.name, count: 0, active: 0 });
  }
  for (const card of cards) {
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
      const ct = completionTimes.get(card.id);
      if (ct && isInRange(ct, start, end)) n++;
    }
    throughput.push({ weekStart: start.toISOString().slice(0, 10), completed: n });
  }

  return {
    fetchedAt: snap.fetchedAt,
    overall: {
      totalCards: cards.length,
      activeCards: cards.filter((c) => !c.closed).length,
      completedCards: completedCount,
      completedThisMonth: completedThisMonth.length,
      completedThisWeek: completedThisWeek.length,
      onTimeRate: completedCount > 0 ? onTimeCount / completedCount : 0,
      onTimePct: completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 0,
      avgCycleTimeDays: cycleN > 0 ? Math.round((cycleSum / cycleN) * 10) / 10 : 0,
    },
    byDesigner, byList, byLabel, throughput,
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
