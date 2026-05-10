'use client';

import { useState } from 'react';
import { X, Zap, Plus, Trash2, ArrowRight, Bell, UserPlus, Tag, CheckCircle2 } from 'lucide-react';
import { useBoardStore } from '@/store/boardStore';

interface Rule {
  id: string;
  name: string;
  trigger: 'card_moved' | 'due_soon' | 'card_created';
  triggerValue?: string;
  action: 'notify_line' | 'add_label' | 'assign_member' | 'move_card';
  actionValue?: string;
  enabled: boolean;
}

const DEFAULT_RULES: Rule[] = [
  {
    id: '1', name: 'แจ้ง LINE เมื่องานเสร็จ',
    trigger: 'card_moved', triggerValue: 'เสร็จแล้ว',
    action: 'notify_line', actionValue: 'งาน "{card}" เสร็จแล้ว ✅',
    enabled: true,
  },
  {
    id: '2', name: 'เตือน deadline ล่วงหน้า 1 วัน',
    trigger: 'due_soon', triggerValue: '1',
    action: 'notify_line', actionValue: '⏰ งาน "{card}" จะถึง deadline พรุ่งนี้!',
    enabled: true,
  },
  {
    id: '3', name: 'ติด label ด่วน เมื่อย้ายเข้า Fast Lane',
    trigger: 'card_moved', triggerValue: 'Fast Lane',
    action: 'add_label', actionValue: 'ด่วน',
    enabled: false,
  },
];

export default function AutomationRules({ onClose }: { onClose: () => void }) {
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
  const [showAdd, setShowAdd] = useState(false);

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case 'card_moved': return <ArrowRight size={14} className="text-blue-400" />;
      case 'due_soon': return <Bell size={14} className="text-amber-400" />;
      case 'card_created': return <Plus size={14} className="text-emerald-400" />;
      default: return <Zap size={14} className="text-purple-400" />;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'notify_line': return <Bell size={14} className="text-green-400" />;
      case 'add_label': return <Tag size={14} className="text-purple-400" />;
      case 'assign_member': return <UserPlus size={14} className="text-pink-400" />;
      case 'move_card': return <ArrowRight size={14} className="text-cyan-400" />;
      default: return <Zap size={14} className="text-gray-400" />;
    }
  };

  const getTriggerText = (r: Rule) => {
    switch (r.trigger) {
      case 'card_moved': return `เมื่อย้ายการ์ดเข้า "${r.triggerValue}"`;
      case 'due_soon': return `เมื่อเหลือ ${r.triggerValue} วัน ก่อน deadline`;
      case 'card_created': return 'เมื่อสร้างการ์ดใหม่';
      default: return r.trigger;
    }
  };

  const getActionText = (r: Rule) => {
    switch (r.action) {
      case 'notify_line': return `แจ้งเตือน LINE: ${r.actionValue}`;
      case 'add_label': return `ติดป้าย "${r.actionValue}"`;
      case 'assign_member': return `Assign ให้ ${r.actionValue}`;
      case 'move_card': return `ย้ายไป "${r.actionValue}"`;
      default: return r.action;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1d23] rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl border border-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Automation</h3>
              <p className="text-xs text-gray-400">{rules.filter(r => r.enabled).length} rules ทำงานอยู่</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-4 space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`rounded-xl border p-4 transition-all ${
                rule.enabled ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap size={14} className={rule.enabled ? 'text-amber-400' : 'text-gray-600'} />
                  <span className="text-sm font-medium text-white">{rule.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      rule.enabled ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      rule.enabled ? 'left-5.5 translate-x-1' : 'left-0.5'
                    }`} />
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 flex items-center gap-1">
                    {getTriggerIcon(rule.trigger)} เมื่อ
                  </span>
                  <span className="text-gray-300">{getTriggerText(rule)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 flex items-center gap-1">
                    {getActionIcon(rule.action)} ทำ
                  </span>
                  <span className="text-gray-300">{getActionText(rule)}</span>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              const newRule: Rule = {
                id: String(Date.now()),
                name: 'Rule ใหม่',
                trigger: 'card_moved',
                triggerValue: '',
                action: 'notify_line',
                actionValue: '',
                enabled: true,
              };
              setRules([...rules, newRule]);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
          >
            <Plus size={16} /> เพิ่ม Rule ใหม่
          </button>
        </div>

        <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02]">
          <p className="text-[10px] text-gray-500 text-center">
            Automation จะทำงานเมื่อเชื่อมต่อ LINE Bot แล้ว • ไปที่ ตั้งค่า &gt; เชื่อมต่อ LINE
          </p>
        </div>
      </div>
    </div>
  );
}
