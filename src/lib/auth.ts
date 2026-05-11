import { supabase } from './supabase';

export interface Profile {
  id: string;
  email: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl?: string;
}

const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { name } },
  });
  if (error) return { error };
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      name,
      initials: initialsFromName(name),
      color: colorFromId(data.user.id),
    });
  }
  return { data };
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) {
    const name = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
    const newProfile = {
      id: user.id, email: user.email!, name,
      initials: initialsFromName(name), color: colorFromId(user.id),
    };
    await supabase.from('profiles').upsert(newProfile);
    return newProfile;
  }
  return {
    id: profile.id, email: profile.email, name: profile.name,
    initials: profile.initials, color: profile.color, avatarUrl: profile.avatar_url,
  };
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data } = await supabase.from('profiles').select('*');
  return (data || []).map((p: any) => ({
    id: p.id, email: p.email, name: p.name,
    initials: p.initials, color: p.color, avatarUrl: p.avatar_url,
  }));
}
