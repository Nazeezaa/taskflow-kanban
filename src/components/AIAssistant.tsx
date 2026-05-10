'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Bot, User } from 'lucide-react';
import { useBoardStore } from '@/store/boardStore';

export default function AIAssistant() {
  const { showAI, toggleAI, aiMessages, addAIMessage, boards, activeBoardId } = useBoardStore();
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  if (!showAI) return null;

  const board = boards.find(b => b.id === activeBoardId);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const msg = input.trim();
    setInput('');
    addAIMessage('user', msg);
    setIsThinking(true);

    setTimeout(() => {
      const response = generateAIResponse(msg, board);
      addAIMessage('assistant', response);
      setIsThinking(false);
    }, 800 + Math.random() * 1200);
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-[#1a1d23] border-l border-white/10 z-40 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI ผู้ช่วย</h3>
            <p className="text-xs text-gray-400">จัดการงานอัจฉริยะ</p>
          </div>
        </div>
        <button onClick={toggleAI} className="p-1 hover:bg-white/10 rounded text-gray-400">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {aiMessages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <Bot size={32} className="text-purple-400" />
            </div>
            <p className="text-gray-300 font-medium mb-2">สวัสดี! ผมเป็น AI ผู้ช่วย</p>
            <p className="text-gray-500 text-sm mb-4">ถามอะไรก็ได้เกี่ยวกับงานในบอร์ด</p>
            <div className="space-y-2">
              {[
                'สรุปงานทั้งหมดให้หน่อย',
                'งานไหนเลย deadline?',
                'แนะนำลำดับความสำคัญ',
                'วิเคราะห์ workload ทีม',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  💡 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {aiMessages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-gray-300'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-white/5 rounded-xl px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="ถาม AI ได้เลย..."
            className="flex-1 bg-white/5 text-sm text-white rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-500"
          />
          <button
            onClick={handleSend}
            disabled={isThinking}
            className="px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function generateAIResponse(query: string, board: any): string {
  if (!board) return 'ไม่พบข้อมูลบอร์ด กรุณาเลือกบอร์ดก่อน';

  const allCards = board.lists.flatMap((l: any) => l.cards.map((c: any) => ({ ...c, listTitle: l.title })));
  const totalCards = allCards.length;

  const q = query.toLowerCase();

  if (q.includes('สรุป') || q.includes('ทั้งหมด') || q.includes('overview')) {
    const listSummary = board.lists
      .filter((l: any) => l.cards.length > 0)
      .map((l: any) => `• ${l.title}: ${l.cards.length} การ์ด`)
      .join('\n');

    return `📊 สรุปบอร์ด "${board.title}"\n\nมีทั้งหมด ${totalCards} การ์ด ใน ${board.lists.length} lists\n\n${listSummary}\n\n💡 แนะนำ: ควรเคลียร์งานที่อยู่ใน "ปั่นงานด่วน" ก่อน เพราะมีงาน urgent อยู่`;
  }

  if (q.includes('deadline') || q.includes('เลย') || q.includes('overdue') || q.includes('หมดเวลา')) {
    const overdue = allCards.filter((c: any) => c.dueDate && new Date(c.dueDate) < new Date());
    if (overdue.length === 0) return '✅ ไม่มีงานที่เลย deadline\n\nทุกงานยังอยู่ในกำหนดเวลา';
    const list = overdue.map((c: any) => `⚠️ "${c.title}" - กำหนด ${c.dueDate} (อยู่ใน: ${c.listTitle})`).join('\n');
    return `🚨 มี ${overdue.length} งานที่เลย deadline:\n\n${list}\n\n💡 ควรจัดการงานเหล่านี้โดยด่วน!`;
  }

  if (q.includes('ลำดับ') || q.includes('priority') || q.includes('สำคัญ') || q.includes('แนะนำ')) {
    const urgent = allCards.filter((c: any) => c.labels.some((l: any) => l.name === 'ด่วน'));
    const withDue = allCards.filter((c: any) => c.dueDate).sort((a: any, b: any) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    let response = '📋 แนะนำลำดับความสำคัญ:\n\n';
    if (urgent.length > 0) {
      response += '🔴 งานด่วน:\n' + urgent.map((c: any) => `  • ${c.title}`).join('\n') + '\n\n';
    }
    if (withDue.length > 0) {
      response += '📅 งานที่มี deadline (เรียงตามวัน):\n' + withDue.slice(0, 5).map((c: any) => `  • ${c.title} - ${c.dueDate}`).join('\n') + '\n\n';
    }
    response += '💡 ควรโฟกัสงานด่วนก่อน แล้วค่อยทำงานที่ใกล้ deadline';
    return response;
  }

  if (q.includes('workload') || q.includes('ทีม') || q.includes('สมาชิก') || q.includes('คน')) {
    const memberCards: Record<string, number> = {};
    allCards.forEach((c: any) => {
      c.members.forEach((m: any) => {
        memberCards[m.name] = (memberCards[m.name] || 0) + 1;
      });
    });
    const unassigned = allCards.filter((c: any) => c.members.length === 0).length;

    let response = '👥 วิเคราะห์ Workload ทีม:\n\n';
    Object.entries(memberCards).sort(([, a], [, b]) => (b as number) - (a as number)).forEach(([name, count]) => {
      const bar = '█'.repeat(Math.min(count as number, 10));
      response += `${name}: ${bar} ${count} งาน\n`;
    });
    if (unassigned > 0) {
      response += `\n⚠️ มี ${unassigned} งานที่ยังไม่ assign ให้ใคร`;
    }
    response += '\n\n💡 ควรกระจายงานให้สมดุลในทีม';
    return response;
  }

  if (q.includes('line') || q.includes('ไลน์') || q.includes('แจ้งเตือน') || q.includes('notify')) {
    return '🔔 ระบบแจ้งเตือนผ่าน LINE:\n\nสามารถเชื่อมต่อ LINE ได้ที่เมนูตั้งค่า\nเมื่อเชื่อมต่อแล้ว จะได้รับแจ้งเตือน:\n• เมื่อมี card ใหม่\n• เมื่อถึง deadline\n• เมื่อมีคนคอมเมนต์\n• สรุปงานรายวัน\n\n💡 ไปที่ ⚙️ ตั้งค่า > เชื่อมต่อ LINE';
  }

  return `🤖 ผมเข้าใจคำถามของคุณ\n\nตอนนี้บอร์ดมี ${totalCards} การ์ด ใน ${board.lists.length} lists\n\nลองถามได้เช่น:\n• "สรุปงานทั้งหมด"\n• "งานไหนเลย deadline"\n• "แนะนำลำดับความสำคัญ"\n• "วิเคราะห์ workload ทีม"`;
}
