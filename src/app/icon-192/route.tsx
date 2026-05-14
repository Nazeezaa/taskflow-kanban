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
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 44, height: 44, background: 'white', borderRadius: 8 }} />
            <div style={{ width: 44, height: 44, background: 'white', borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 44, height: 44, background: 'white', borderRadius: 8 }} />
            <div style={{ width: 44, height: 44, background: 'white', borderRadius: 8 }} />
          </div>
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
