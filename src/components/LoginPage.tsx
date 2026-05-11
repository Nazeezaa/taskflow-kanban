'use client';

import { useState } from 'react';
import { signIn, signUp } from '@/lib/auth';

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        if (!name.trim()) { setError('กรุณาใส่ชื่อ'); setLoading(false); return; }
        const { error } = await signUp(email, password, name.trim());
        if (error) throw error;
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[#0d1117] px-4">
      <div className="w-full max-w-md bg-[#161b22] rounded-2xl shadow-2xl p-8 border border-white/10">
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-1">TaskFlow</h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          {mode === 'signin' ? 'เข้าสู่ระบบเพื่อใช้งาน' : 'สร้างบัญชีใหม่'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">ชื่อ</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="ชื่อของคุณ"
                className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 block mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6}
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 placeholder-gray-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg py-2.5 transition-all disabled:opacity-50"
          >
            {loading ? 'กำลังโหลด...' : mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
            className="text-sm text-gray-400 hover:text-white"
          >
            {mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
          </button>
        </div>
      </div>
    </div>
  );
}
