'use client';

import { useEffect, useState } from 'react';
import { X, Download, Bell } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosShow, setIosShow] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const dismissed = localStorage.getItem('taskflow-install-dismissed');
    if (dismissed) return;

    // Check standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      setIosShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if ('Notification' in window) setNotifPermission(Notification.permission);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setShow(false);
    setInstallEvent(null);
  };

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      new Notification('TaskFlow', {
        body: 'เปิดการแจ้งเตือนสำเร็จ! 🎉',
        icon: '/icon-192',
      });
    }
  };

  const dismiss = () => {
    localStorage.setItem('taskflow-install-dismissed', '1');
    setShow(false);
    setIosShow(false);
  };

  if (!show && !iosShow && notifPermission === 'granted') return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl shadow-2xl p-4 text-white">
      <button onClick={dismiss} className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded">
        <X size={14} />
      </button>

      {show && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Download size={18} />
            <h3 className="font-semibold text-sm">ติดตั้งเป็นแอป</h3>
          </div>
          <p className="text-xs text-white/80 mb-3">
            ติดตั้ง TaskFlow บนเครื่อง เปิดเร็วกว่า + แจ้งเตือนได้
          </p>
          <button
            onClick={handleInstall}
            className="w-full bg-white text-blue-700 font-medium text-sm py-2 rounded-lg hover:bg-white/90"
          >
            ติดตั้งเลย
          </button>
        </>
      )}

      {iosShow && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Download size={18} />
            <h3 className="font-semibold text-sm">เพิ่มที่หน้าจอ</h3>
          </div>
          <p className="text-xs text-white/80">
            กด <span className="font-mono bg-white/20 px-1 rounded">Share ⬆️</span> → "Add to Home Screen"
          </p>
        </>
      )}

      {!show && !iosShow && notifPermission !== 'granted' && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Bell size={18} />
            <h3 className="font-semibold text-sm">เปิดแจ้งเตือน</h3>
          </div>
          <p className="text-xs text-white/80 mb-3">เตือนเมื่อมีงานใหม่/deadline</p>
          <button
            onClick={handleEnableNotifications}
            className="w-full bg-white text-blue-700 font-medium text-sm py-2 rounded-lg hover:bg-white/90"
          >
            อนุญาต
          </button>
        </>
      )}
    </div>
  );
}
