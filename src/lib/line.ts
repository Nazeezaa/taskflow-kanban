const LINE_API = 'https://api.line.me/v2/bot/message';

export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  const res = await fetch(`${LINE_API}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  return res.json();
}

export async function pushMessage(to: string, messages: LineMessage[]) {
  const res = await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  return res.json();
}

export function textMessage(text: string): LineMessage {
  return { type: 'text', text };
}

export function flexCardMessage(title: string, list: string, dueDate?: string): LineMessage {
  return {
    type: 'flex',
    altText: `งาน: ${title}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text', text: '📋 TaskFlow', size: 'xs', color: '#aaaaaa',
        }],
        paddingBottom: '0px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: title, weight: 'bold', size: 'md', wrap: true },
          { type: 'text', text: `อยู่ใน: ${list}`, size: 'xs', color: '#aaaaaa', margin: 'md' },
          ...(dueDate ? [{
            type: 'box' as const,
            layout: 'baseline' as const,
            margin: 'md' as const,
            contents: [
              { type: 'text' as const, text: `📅 กำหนด: ${dueDate}`, size: 'xs' as const, color: '#ff6b6b' },
            ],
          }] : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'button',
          action: { type: 'uri', label: 'เปิดดูงาน', uri: process.env.NEXT_PUBLIC_APP_URL || 'https://taskflow.app' },
          style: 'primary',
          height: 'sm',
          color: '#3b82f6',
        }],
      },
    },
  };
}

export function reminderMessage(cards: { title: string; dueDate: string; list: string }[]): LineMessage {
  const items = cards.map(c => `⏰ ${c.title}\n   กำหนด: ${c.dueDate} | อยู่ใน: ${c.list}`).join('\n\n');
  return textMessage(`🔔 แจ้งเตือนงานที่ใกล้ deadline!\n\n${items}\n\nเปิด TaskFlow เพื่อจัดการงาน`);
}

interface LineMessage {
  type: string;
  text?: string;
  altText?: string;
  contents?: any;
}
