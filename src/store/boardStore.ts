import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Board, Card, List, Label, Member, CardActivity } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  fetchBoard, dbAddCard, dbUpdateCard, dbDeleteCard, dbMoveCard,
  dbAddList, dbDeleteList, dbAddComment, dbAddChecklist,
  dbAddChecklistItem, dbToggleChecklistItem, dbToggleCardLabel, dbToggleCardMember,
} from '@/lib/db';

interface BoardState {
  boards: Board[];
  activeBoardId: string | null;
  selectedCardId: string | null;
  searchQuery: string;
  aiMessages: { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }[];
  showAI: boolean;
  showDashboard: boolean;
  activeView: 'board' | 'calendar';
  showActivity: boolean;
  showAutomation: boolean;
  loading: boolean;

  loadBoard: () => Promise<void>;
  getActiveBoard: () => Board | undefined;
  setActiveBoard: (id: string) => void;
  setSelectedCard: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleAI: () => void;
  toggleDashboard: () => void;
  setActiveView: (view: 'board' | 'calendar') => void;
  toggleActivity: () => void;
  toggleAutomation: () => void;
  addAIMessage: (role: 'user' | 'assistant', content: string) => void;

  addList: (boardId: string, title: string) => void;
  deleteList: (listId: string) => void;

  addCard: (listId: string, title: string) => void;
  updateCard: (cardId: string, updates: Partial<Card>) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, toListId: string, toIndex: number) => void;

  addComment: (cardId: string, text: string, authorName: string) => void;
  addChecklist: (cardId: string, title: string) => void;
  addChecklistItem: (cardId: string, checklistId: string, text: string) => void;
  toggleChecklistItem: (cardId: string, checklistId: string, itemId: string) => void;
  toggleCardLabel: (cardId: string, label: Label) => void;
  toggleCardMember: (cardId: string, member: Member) => void;
}

export const useBoardStore = create<BoardState>()((set, get) => ({
  boards: [],
  activeBoardId: null,
  selectedCardId: null,
  searchQuery: '',
  aiMessages: [],
  showAI: false,
  showDashboard: false,
  activeView: 'board' as const,
  showActivity: false,
  showAutomation: false,
  loading: true,

  loadBoard: async () => {
    set({ loading: true });
    const board = await fetchBoard();
    if (board) {
      set({ boards: [board], activeBoardId: board.id, loading: false });
    } else {
      set({ loading: false });
    }
  },

  getActiveBoard: () => get().boards.find(b => b.id === get().activeBoardId),
  setActiveBoard: (id) => set({ activeBoardId: id }),
  setSelectedCard: (id) => set({ selectedCardId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleAI: () => set(s => ({ showAI: !s.showAI })),
  toggleDashboard: () => set(s => ({ showDashboard: !s.showDashboard })),
  setActiveView: (view) => set({ activeView: view }),
  toggleActivity: () => set(s => ({ showActivity: !s.showActivity })),
  toggleAutomation: () => set(s => ({ showAutomation: !s.showAutomation })),
  addAIMessage: (role, content) => set(s => ({
    aiMessages: [...s.aiMessages, { id: uuidv4(), role, content, timestamp: new Date().toISOString() }],
  })),

  addList: async (boardId, title) => {
    const { data } = await dbAddList(boardId, title);
    if (data) get().loadBoard();
  },

  deleteList: async (listId) => {
    await dbDeleteList(listId);
    get().loadBoard();
  },

  addCard: async (listId, title) => {
    await dbAddCard(listId, title);
    get().loadBoard();
  },

  updateCard: async (cardId, updates) => {
    await dbUpdateCard(cardId, updates);
    // Optimistic update
    set(s => ({
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.map(c => c.id === cardId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c),
        })),
      })),
    }));
  },

  deleteCard: async (cardId) => {
    await dbDeleteCard(cardId);
    set(s => ({
      selectedCardId: s.selectedCardId === cardId ? null : s.selectedCardId,
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.filter(c => c.id !== cardId),
        })),
      })),
    }));
  },

  moveCard: async (cardId, toListId, toIndex) => {
    const board = get().getActiveBoard();
    if (!board) return;

    let fromListTitle = '';
    let toListTitle = '';
    for (const l of board.lists) {
      if (l.cards.some(c => c.id === cardId)) fromListTitle = l.title;
      if (l.id === toListId) toListTitle = l.title;
    }

    // Optimistic update
    set(s => {
      const boards = s.boards.map(b => {
        let movedCard: Card | null = null;
        const listsWithout = b.lists.map(l => {
          const idx = l.cards.findIndex(c => c.id === cardId);
          if (idx === -1) return l;
          movedCard = { ...l.cards[idx], listId: toListId };
          return { ...l, cards: l.cards.filter(c => c.id !== cardId) };
        });
        if (!movedCard) return b;
        const listsWith = listsWithout.map(l => {
          if (l.id !== toListId) return l;
          const cards = [...l.cards];
          cards.splice(toIndex, 0, movedCard!);
          return { ...l, cards: cards.map((c, i) => ({ ...c, position: i })) };
        });
        return { ...b, lists: listsWith };
      });
      return { boards };
    });

    await dbMoveCard(cardId, toListId, toIndex, fromListTitle, toListTitle);
  },

  addComment: async (cardId, text, authorName) => {
    const { data } = await dbAddComment(cardId, text, authorName);
    if (data) {
      set(s => ({
        boards: s.boards.map(b => ({
          ...b, lists: b.lists.map(l => ({
            ...l, cards: l.cards.map(c => c.id === cardId ? {
              ...c, comments: [...c.comments, {
                id: data.id, text, authorId: '', authorName, createdAt: data.created_at,
              }],
            } : c),
          })),
        })),
      }));
    }
  },

  addChecklist: async (cardId, title) => {
    const { data } = await dbAddChecklist(cardId, title);
    if (data) {
      set(s => ({
        boards: s.boards.map(b => ({
          ...b, lists: b.lists.map(l => ({
            ...l, cards: l.cards.map(c => c.id === cardId ? {
              ...c, checklists: [...c.checklists, { id: data.id, title, items: [] }],
            } : c),
          })),
        })),
      }));
    }
  },

  addChecklistItem: async (cardId, checklistId, text) => {
    const { data } = await dbAddChecklistItem(checklistId, text);
    if (data) {
      set(s => ({
        boards: s.boards.map(b => ({
          ...b, lists: b.lists.map(l => ({
            ...l, cards: l.cards.map(c => c.id === cardId ? {
              ...c, checklists: c.checklists.map(cl => cl.id === checklistId ? {
                ...cl, items: [...cl.items, { id: data.id, text, completed: false }],
              } : cl),
            } : c),
          })),
        })),
      }));
    }
  },

  toggleChecklistItem: async (cardId, checklistId, itemId) => {
    const board = get().getActiveBoard();
    const card = board?.lists.flatMap(l => l.cards).find(c => c.id === cardId);
    const item = card?.checklists.find(cl => cl.id === checklistId)?.items.find(i => i.id === itemId);
    if (!item) return;

    const newVal = !item.completed;
    await dbToggleChecklistItem(itemId, newVal);

    set(s => ({
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.map(c => c.id === cardId ? {
            ...c, checklists: c.checklists.map(cl => cl.id === checklistId ? {
              ...cl, items: cl.items.map(i => i.id === itemId ? { ...i, completed: newVal } : i),
            } : cl),
          } : c),
        })),
      })),
    }));
  },

  toggleCardLabel: async (cardId, label) => {
    const board = get().getActiveBoard();
    const card = board?.lists.flatMap(l => l.cards).find(c => c.id === cardId);
    const has = card?.labels.some(l => l.id === label.id) || false;

    await dbToggleCardLabel(cardId, label.id, has);

    set(s => ({
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.map(c => {
            if (c.id !== cardId) return c;
            return { ...c, labels: has ? c.labels.filter(l => l.id !== label.id) : [...c.labels, label] };
          }),
        })),
      })),
    }));
  },

  toggleCardMember: async (cardId, member) => {
    const board = get().getActiveBoard();
    const card = board?.lists.flatMap(l => l.cards).find(c => c.id === cardId);
    const has = card?.members.some(m => m.id === member.id) || false;

    await dbToggleCardMember(cardId, member.id, has);

    set(s => ({
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.map(c => {
            if (c.id !== cardId) return c;
            return { ...c, members: has ? c.members.filter(m => m.id !== member.id) : [...c.members, member] };
          }),
        })),
      })),
    }));
  },
}));

// Realtime subscriptions
if (typeof window !== 'undefined') {
  supabase
    .channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => {
      useBoardStore.getState().loadBoard();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, () => {
      useBoardStore.getState().loadBoard();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
      useBoardStore.getState().loadBoard();
    })
    .subscribe();
}
