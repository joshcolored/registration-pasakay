'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAdminSession } from '@/lib/adminSession';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if admin is logged in
    const adminUser = getStoredAdminSession();
    if (adminUser) {
      router.push('/dashboard');
    } else {
      // Check if URL contains admin hint, redirect to login
      if (typeof window !== 'undefined' && window.location.search.includes('admin')) {
        router.push('/pasakay/login');
      } else {
        // Redirect to registration landing page for drivers and merchants
        router.push('/register');
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
