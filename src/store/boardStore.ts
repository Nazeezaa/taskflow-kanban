import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Board, Card, List, Label, Member } from '@/types';
import { supabase } from '@/lib/supabase';
import { getCurrentProfile, getAllProfiles, type Profile } from '@/lib/auth';
import {
  fetchBoard, dbAddCard, dbUpdateCard, dbDeleteCard, dbMoveCard,
  dbAddList, dbDeleteList, dbAddComment, dbUpdateComment, dbDeleteComment,
  dbAddChecklist, dbDeleteChecklist, dbAddChecklistItem, dbToggleChecklistItem, dbDeleteChecklistItem,
  dbToggleCardLabel, dbToggleCardMember,
  dbAddAttachment, dbDeleteAttachment, dbSetAttachmentAsCover, dbRemoveCover, dbUploadFile,
  dbArchiveCard, dbCopyCard, dbMoveCardToList,
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
  currentUser: Profile | null;
  allUsers: Profile[];
  onlineUserIds: string[];

  loadAuth: () => Promise<void>;
  setCurrentUser: (u: Profile | null) => void;
  setOnlineUsers: (ids: string[]) => void;
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
  archiveCard: (cardId: string) => void;
  copyCard: (card: Card, toListId: string) => void;
  moveCardToList: (cardId: string, toListId: string) => void;
  moveCard: (cardId: string, toListId: string, toIndex: number) => void;

  addComment: (cardId: string, text: string, authorName: string, imageUrl?: string) => void;
  updateComment: (cardId: string, commentId: string, text: string) => void;
  deleteComment: (cardId: string, commentId: string) => void;

  addChecklist: (cardId: string, title: string) => void;
  deleteChecklist: (cardId: string, checklistId: string) => void;
  addChecklistItem: (cardId: string, checklistId: string, text: string) => void;
  toggleChecklistItem: (cardId: string, checklistId: string, itemId: string) => void;
  deleteChecklistItem: (cardId: string, checklistId: string, itemId: string) => void;

  toggleCardLabel: (cardId: string, label: Label) => void;
  toggleCardMember: (cardId: string, member: Member) => void;

  uploadAttachment: (cardId: string, file: File) => Promise<void>;
  deleteAttachment: (cardId: string, attachmentId: string) => void;
  setAttachmentAsCover: (cardId: string, attachmentId: string, url: string) => void;
  removeCover: (cardId: string) => void;
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
  currentUser: null,
  allUsers: [],
  onlineUserIds: [],

  loadAuth: async () => {
    const [profile, allProfiles] = await Promise.all([getCurrentProfile(), getAllProfiles()]);
    set({ currentUser: profile, allUsers: allProfiles });
  },
  setCurrentUser: (u) => set({ currentUser: u }),
  setOnlineUsers: (ids) => set({ onlineUserIds: ids }),

  loadBoard: async () => {
    // Only show loading screen on initial load (when no board yet)
    const hasBoard = get().boards.length > 0;
    if (!hasBoard) set({ loading: true });
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

  // --- Lists ---
  addList: async (boardId, title) => {
    const { data } = await dbAddList(boardId, title);
    if (data) get().loadBoard();
  },
  deleteList: async (listId) => {
    await dbDeleteList(listId);
    get().loadBoard();
  },

  // --- Cards ---
  addCard: async (listId, title) => {
    // Optimistic - add placeholder card instantly so UI feels snappy
    const tempId = `temp-${uuidv4()}`;
    const now = new Date().toISOString();
    const tempCard: Card = {
      id: tempId, title, description: '', listId, position: 9999,
      labels: [], members: [], checklists: [], comments: [], attachments: [], activities: [],
      isWatching: false, archived: false, createdAt: now, updatedAt: now,
    };
    set(s => ({
      boards: s.boards.map(b => ({
        ...b,
        lists: b.lists.map(l => l.id === listId ? { ...l, cards: [...l.cards, tempCard] } : l),
      })),
    }));
    await dbAddCard(listId, title);
    get().loadBoard();
  },

  updateCard: async (cardId, updates) => {
    await dbUpdateCard(cardId, updates);
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

  archiveCard: async (cardId) => {
    await dbArchiveCard(cardId);
    set(s => ({
      selectedCardId: s.selectedCardId === cardId ? null : s.selectedCardId,
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.filter(c => c.id !== cardId),
        })),
      })),
    }));
  },

  copyCard: async (card, toListId) => {
    await dbCopyCard(card, toListId);
    get().loadBoard();
  },

  moveCardToList: async (cardId, toListId) => {
    const board = get().getActiveBoard();
    if (!board) return;
    let fromListTitle = '';
    let toListTitle = '';
    for (const l of board.lists) {
      if (l.cards.some(c => c.id === cardId)) fromListTitle = l.title;
      if (l.id === toListId) toListTitle = l.title;
    }
    await dbMoveCardToList(cardId, toListId, fromListTitle, toListTitle);
    get().loadBoard();
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

  // --- Comments ---
  addComment: async (cardId, text, authorName, imageUrl) => {
    const { data } = await dbAddComment(cardId, text, authorName, imageUrl);
    if (data) get().loadBoard();
  },

  updateComment: async (cardId, commentId, text) => {
    await dbUpdateComment(commentId, text);
    set(s => ({
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.map(c => c.id === cardId ? {
            ...c, comments: c.comments.map(cm => cm.id === commentId ? { ...cm, text, updatedAt: new Date().toISOString() } : cm),
          } : c),
        })),
      })),
    }));
  },

  deleteComment: async (cardId, commentId) => {
    await dbDeleteComment(commentId);
    set(s => ({
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.map(c => c.id === cardId ? {
            ...c, comments: c.comments.filter(cm => cm.id !== commentId),
          } : c),
        })),
      })),
    }));
  },

  // --- Checklists ---
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

  deleteChecklist: async (cardId, checklistId) => {
    await dbDeleteChecklist(checklistId);
    set(s => ({
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.map(c => c.id === cardId ? {
            ...c, checklists: c.checklists.filter(cl => cl.id !== checklistId),
          } : c),
        })),
      })),
    }));
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

  deleteChecklistItem: async (cardId, checklistId, itemId) => {
    await dbDeleteChecklistItem(itemId);
    set(s => ({
      boards: s.boards.map(b => ({
        ...b, lists: b.lists.map(l => ({
          ...l, cards: l.cards.map(c => c.id === cardId ? {
            ...c, checklists: c.checklists.map(cl => cl.id === checklistId ? {
              ...cl, items: cl.items.filter(i => i.id !== itemId),
            } : cl),
          } : c),
        })),
      })),
    }));
  },

  // --- Labels & Members ---
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

  // --- Attachments ---
  uploadAttachment: async (cardId, file) => {
    const result = await dbUploadFile(cardId, file);
    if (!result) return;
    await dbAddAttachment(cardId, file.name, result.url, file.type, file.size);
    get().loadBoard();
  },

  deleteAttachment: async (cardId, attachmentId) => {
    await dbDeleteAttachment(attachmentId);
    get().loadBoard();
  },

  setAttachmentAsCover: async (cardId, attachmentId, url) => {
    await dbSetAttachmentAsCover(cardId, attachmentId, url);
    get().loadBoard();
  },

  removeCover: async (cardId) => {
    await dbRemoveCover(cardId);
    get().loadBoard();
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, () => {
      useBoardStore.getState().loadBoard();
    })
    .subscribe();
}
