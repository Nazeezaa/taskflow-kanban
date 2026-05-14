import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'white', borderRadius: 6 }} />
            <div style={{ width: 40, height: 40, background: 'white', borderRadius: 6 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 40, height: 40, background: 'white', borderRadius: 6 }} />
            <div style={{ width: 40, height: 40, background: 'white', borderRadius: 6 }} />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
