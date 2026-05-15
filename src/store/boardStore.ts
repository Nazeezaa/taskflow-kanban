/**
 * Minimal app state — auth + online presence only.
 * TaskFlow is now a read-only KPI dashboard; all kanban CRUD lives in Trello.
 */
import { create } from 'zustand';
import { getCurrentProfile, getAllProfiles, type Profile } from '@/lib/auth';

interface State {
  currentUser: Profile | null;
  allUsers: Profile[];
  onlineUserIds: string[];
  loadAuth: () => Promise<void>;
  setCurrentUser: (u: Profile | null) => void;
  setOnlineUsers: (ids: string[]) => void;
}

export const useBoardStore = create<State>()((set) => ({
  currentUser: null,
  allUsers: [],
  onlineUserIds: [],
  loadAuth: async () => {
    const [profile, allProfiles] = await Promise.all([getCurrentProfile(), getAllProfiles()]);
    set({ currentUser: profile, allUsers: allProfiles });
  },
  setCurrentUser: (u) => set({ currentUser: u }),
  setOnlineUsers: (ids) => set({ onlineUserIds: ids }),
}));
