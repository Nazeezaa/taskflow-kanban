'use client';

import { useState } from 'react';
import { X, Copy, Plus, FileText, Image, Video, PenTool, BarChart2, Package } from 'lucide-react';
import { useBoardStore } from '@/store/boardStore';

interface Template {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  card: {
    title: string;
    description: string;
    checklists: { title: string; items: string[] }[];
    labelIds: string[];
  };
}

const TEMPLATES: Template[] = [
  {
    id: 'poster', name: 'ออกแบบโปสเตอร์', icon: <PenTool size={18} />,
    description: 'Template สำหรับงานออกแบบโปสเตอร์โปรโมชั่น',
    card: {
      title: 'ออกแบบโปสเตอร์ — [ชื่อแคมเปญ]',
      description: '## Brief\n- วัตถุประสงค์: \n- กลุ่มเป้าหมาย: \n- ช่องทาง: Facebook / Instagram / LINE\n\n## ข้อมูลที่ต้องใส่\n- ชื่อสินค้า\n- ราคา / โปรโมชั่น\n- ช่วงเวลา\n\n## โทนสี\n- สีหลัก: \n- สีรอง: ',
      checklists: [{ title: 'ขั้นตอน', items: ['รับ Brief จากทีม', 'ร่างแบบ Draft 1', 'ส่ง QC ตรวจ', 'แก้ไขตาม Feedback', 'ส่ง Final', 'โพสต์'] }],
      labelIds: ['3'],
    },
  },
  {
    id: 'price-update', name: 'อัพเดทราคาสินค้า', icon: <BarChart2 size={18} />,
    description: 'Template สำหรับอัพเดทราคาเครื่องชงกาแฟ',
    card: {
      title: 'Update ราคา — [ชื่อแบรนด์]',
      description: '## แบรนด์: \n## แหล่งที่มา: CP Retailink / Direct\n\n## หมายเหตุ\n- เช็คราคาคู่แข่ง\n- อัพเดทในเว็บ + Social',
      checklists: [{ title: 'รุ่นที่ต้องอัพเดท', items: ['รุ่น 1', 'รุ่น 2', 'รุ่น 3'] }, { title: 'ช่องทาง', items: ['เว็บไซต์', 'Facebook', 'LINE', 'Shopee'] }],
      labelIds: ['5'],
    },
  },
  {
    id: 'video', name: 'ทำวีดีโอ Content', icon: <Video size={18} />,
    description: 'Template สำหรับผลิต VDO Content',
    card: {
      title: 'VDO — [หัวข้อ]',
      description: '## Concept\n- หัวข้อ: \n- ความยาว: \n- แพลตฟอร์ม: TikTok / Reels / YouTube\n\n## Key Message\n- ',
      checklists: [{ title: 'Production', items: ['เขียน Script', 'เตรียมอุปกรณ์', 'ถ่ายทำ', 'ตัดต่อ Draft', 'ใส่ซับไตเติ้ล', 'QC ตรวจ', 'แก้ไข', 'Export & โพสต์'] }],
      labelIds: ['2'],
    },
  },
  {
    id: 'social-post', name: 'โพสต์ Social Media', icon: <Image size={18} />,
    description: 'Template สำหรับเตรียม Social Media Post',
    card: {
      title: 'Post — [หัวข้อ]',
      description: '## Content\n- Caption: \n- Hashtag: \n\n## เวลาโพสต์\n- วัน: \n- เวลา: \n\n## Platform\n- [ ] Facebook\n- [ ] Instagram\n- [ ] LINE OA',
      checklists: [{ title: 'Checklist', items: ['เตรียมรูป/กราฟิก', 'เขียน Caption', 'ตรวจ Typo', 'ตั้งเวลาโพสต์', 'ติดตามผล Engagement'] }],
      labelIds: ['2'],
    },
  },
  {
    id: 'product-catalog', name: 'ทำแคตตาล็อกสินค้า', icon: <Package size={18} />,
    description: 'Template สำหรับทำ Product Catalog',
    card: {
      title: 'Catalog — [ชื่อสินค้า/แบรนด์]',
      description: '## ข้อมูลสินค้า\n- ชื่อ: \n- รุ่น: \n- สเปค: \n- ราคา: \n\n## รูปภาพที่ต้องการ\n- ภาพหน้าตรง\n- ภาพด้านข้าง\n- ภาพ detail',
      checklists: [{ title: 'ขั้นตอน', items: ['รวบรวมข้อมูลสินค้า', 'ถ่ายรูปสินค้า', 'ตัดต่อรูป', 'จัดวาง Layout', 'ใส่ราคา+สเปค', 'QC ตรวจ', 'ส่ง Final'] }],
      labelIds: ['3', '5'],
    },
  },
  {
    id: 'article', name: 'เขียนบทความ', icon: <FileText size={18} />,
    description: 'Template สำหรับเขียนบทความ Blog/SEO',
    card: {
      title: 'บทความ — [หัวข้อ]',
      description: '## หัวข้อ: \n## Keyword: \n## ความยาว: ~1000 คำ\n\n## โครงร่าง\n1. \n2. \n3. \n\n## อ้างอิง\n- ',
      checklists: [{ title: 'ขั้นตอน', items: ['Research หัวข้อ', 'เขียน Draft', 'หารูปประกอบ', 'ตรวจ SEO', 'QC เนื้อหา', 'อัพโหลดเว็บ', 'แชร์ Social'] }],
      labelIds: ['3'],
    },
  },
];

export default function CardTemplates({
  listId,
  onClose,
}: {
  listId: string;
  onClose: () => void;
}) {
  const { addCard, boards, activeBoardId, addChecklist, addChecklistItem, toggleCardLabel } = useBoardStore();
  const board = boards.find(b => b.id === activeBoardId);
  const [selected, setSelected] = useState<string | null>(null);

  const handleUseTemplate = (template: Template) => {
    addCard(listId, template.card.title);

    const allCards = board?.lists.flatMap(l => l.cards) || [];
    const newCard = allCards[allCards.length]; // will be added at end

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#282e33] rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Copy size={18} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">เลือก Template</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[65vh] p-3 space-y-2">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => {
                addCard(listId, t.card.title);
                onClose();
              }}
              className={`w-full text-left p-3 rounded-lg border transition-all hover:border-cyan-500/50 hover:bg-cyan-500/5 ${
                selected === t.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/5 bg-white/5'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-cyan-400 flex-shrink-0">
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400">
                      {t.card.checklists.reduce((a, cl) => a + cl.items.length, 0)} รายการ
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400">
                      {t.card.checklists.length} checklist
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
