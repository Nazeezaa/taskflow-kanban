import { NextRequest, NextResponse } from 'next/server';
import { pushMessage, reminderMessage, textMessage } from '@/lib/line';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type, userId, cards } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  switch (type) {
    case 'deadline':
      if (cards?.length > 0) {
        await pushMessage(userId, [reminderMessage(cards)]);
      }
      break;

    case 'daily_summary':
      await pushMessage(userId, [
        textMessage(
          `📊 สรุปงานประจำวัน\n\n` +
          `📋 งานทั้งหมด: ${cards?.total || 0}\n` +
          `✅ เสร็จแล้ว: ${cards?.done || 0}\n` +
          `🔥 งานด่วน: ${cards?.urgent || 0}\n` +
          `⏰ ใกล้ deadline: ${cards?.nearDeadline || 0}\n\n` +
          `เปิด TaskFlow เพื่อจัดการงาน!`
        ),
      ]);
      break;

    case 'card_assigned':
      await pushMessage(userId, [
        textMessage(`📌 คุณได้รับมอบหมายงานใหม่!\n\n"${cards?.title}"\nอยู่ใน: ${cards?.list}\n\nเปิด TaskFlow เพื่อดูรายละเอียด`),
      ]);
      break;

    default:
      return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
  }

  return NextResponse.json({ status: 'sent' });
}
