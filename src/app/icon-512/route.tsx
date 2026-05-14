import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        }}
      >
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ width: 116, height: 116, background: 'white', borderRadius: 22 }} />
            <div style={{ width: 116, height: 116, background: 'white', borderRadius: 22 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ width: 116, height: 116, background: 'white', borderRadius: 22 }} />
            <div style={{ width: 116, height: 116, background: 'white', borderRadius: 22 }} />
          </div>
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
