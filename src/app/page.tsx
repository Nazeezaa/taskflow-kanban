'use client';

import AuthWrapper from '@/components/AuthWrapper';
import TrelloDashboard from '@/components/TrelloDashboard';
import InstallPrompt from '@/components/InstallPrompt';

export default function Home() {
  return (
    <AuthWrapper>
      <TrelloDashboard />
      <InstallPrompt />
    </AuthWrapper>
  );
}
