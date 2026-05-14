import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow - Kanban Board",
  description: "จัดการงานแบบ Kanban พร้อม AI ผู้ช่วย",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TaskFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <link rel="apple-touch-icon" href="/apple-icon" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Aggressive cleanup of any stale service workers / caches
              // (Temporarily disabled SW until we re-verify it doesn't cause stale state)
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => {
                  regs.forEach(r => r.unregister());
                });
              }
              if ('caches' in window) {
                caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
