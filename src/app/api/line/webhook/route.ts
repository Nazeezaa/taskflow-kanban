import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { replyMessage, textMessage, flexCardMessage } from '@/lib/line';

export async function POST(req: NextRequest) {
  const body = await req.text();

  const signature = req.headers.get('x-line-signature');
  if (signature && process.env.LINE_CHANNEL_SECRET) {
    const hash = crypto
      .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET)
      .update(body)
      .digest('base64');
    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
  }

  const data = JSON.parse(body);

  for (const event of data.events || []) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.toLowerCase();
      const replyToken = event.replyToken;

      if (text.includes('สรุป') || text.includes('summary')) {
        await replyMessage(replyToken, [
          textMessage('📊 สรุปงานวันนี้\n\nเปิด TaskFlow เพื่อดูรายละเอียดเต็ม\n👉 กดปุ่ม AI ผู้ช่วยในแอปเพื่อถามรายละเอียดเพิ่มเติม'),
        ]);
      } else if (text.includes('เพิ่ม') || text.includes('add')) {
        const cardTitle = event.message.text.replace(/เพิ่ม|add/gi, '').trim();
        if (cardTitle) {
          await replyMessage(replyToken, [
            flexCardMessage(cardTitle, 'Plan & ไอเดีย'),
            textMessage(`✅ เพิ่มการ์ด "${cardTitle}" แล้ว!`),
          ]);
        } else {
          await replyMessage(replyToken, [
            textMessage('พิมพ์ "เพิ่ม [ชื่องาน]" เพื่อสร้างการ์ดใหม่\nเช่น: เพิ่ม ออกแบบโปสเตอร์โปรโมชั่น'),
          ]);
        }
      } else if (text.includes('deadline') || text.includes('เตือน') || text.includes('งานด่วน')) {
        await replyMessage(replyToken, [
          textMessage('⏰ ตรวจสอบงาน deadline...\n\nเปิด TaskFlow เพื่อดูรายละเอียดงานทั้งหมด'),
        ]);
      } else if (text.includes('help') || text.includes('ช่วย') || text === 'เมนู') {
        await replyMessage(replyToken, [
          textMessage(
            '🤖 TaskFlow Bot - คำสั่งที่ใช้ได้:\n\n' +
            '📋 "สรุป" - สรุปงานทั้งหมด\n' +
            '➕ "เพิ่ม [ชื่องาน]" - เพิ่มการ์ดใหม่\n' +
            '⏰ "deadline" - ดูงานที่ใกล้ deadline\n' +
            '🔔 "เตือน" - ตั้งเตือนงาน\n' +
            '❓ "help" - แสดงเมนูนี้'
          ),
        ]);
      } else {
        await replyMessage(replyToken, [
          textMessage(`ได้รับข้อความ: "${event.message.text}"\n\nพิมพ์ "help" เพื่อดูคำสั่งทั้งหมด`),
        ]);
      }
    }

    if (event.type === 'follow') {
      await replyMessage(event.replyToken, [
        textMessage(
          '🎉 ยินดีต้อนรับสู่ TaskFlow!\n\n' +
          'ผมคือ Bot ผู้ช่วยจัดการงาน\n' +
          'คุณสามารถ:\n' +
          '• เพิ่มงานผ่าน LINE\n' +
          '• รับแจ้งเตือน deadline\n' +
          '• สรุปงานประจำวัน\n\n' +
          'พิมพ์ "help" เพื่อดูคำสั่งทั้งหมด'
        ),
      ]);
    }
  }

  return NextResponse.json({ status: 'ok' });
}

export async function GET() {
  return NextResponse.json({ status: 'LINE webhook is active' });
}
