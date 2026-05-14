'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useBoardStore } from '@/store/boardStore';
import LoginPage from './LoginPage';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { currentUser, loadAuth, setCurrentUser, setOnlineUsers } = useBoardStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Force auth check to never block UI more than 5 seconds
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('[AuthWrapper] auth check timed out — showing UI anyway');
        setChecking(false);
      }
    }, 5000);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadAuth().catch((err) => console.error('[AuthWrapper] loadAuth failed:', err));
        }
      } catch (err) {
        console.error('[AuthWrapper] init failed:', err);
      } finally {
        clearTimeout(timeout);
        if (mounted) setChecking(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadAuth();
      } else {
        setCurrentUser(null);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // Presence channel — track who's online
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('online-users', {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = Object.keys(state);
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            name: currentUser.name,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onSuccess={() => loadAuth()} />;
  }

  return <>{children}</>;
}
