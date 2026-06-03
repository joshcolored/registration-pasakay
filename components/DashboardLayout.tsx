'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Car,
  MapPin,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  UserCheck,
  Map,
  Smartphone,
  Store,
  Truck,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { auth, database } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import {
  clearAdminSession,
  getAdminSessionTimeRemaining,
  getStoredAdminSession,
} from '@/lib/adminSession';
import {
  getAdminNotificationRoute,
  isAdminNotificationTarget,
  isAdminNotificationType,
} from '@/lib/adminNotificationRoutes';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navGroups = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Passengers', href: '/dashboard/users', icon: Users },
      { name: 'Drivers', href: '/dashboard/drivers', icon: Car },
      { name: 'Driver Verification', href: '/dashboard/driver-verification', icon: UserCheck },
      { name: 'Trips', href: '/dashboard/trips', icon: MapPin },
      { name: 'Service Areas', href: '/dashboard/service-areas', icon: Map },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { name: 'Merchants', href: '/dashboard/merchants', icon: Store },
      { name: 'Food Orders', href: '/dashboard/food-orders', icon: Truck },
      { name: 'Payments', href: '/dashboard/payments', icon: CreditCard },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Deleted Accounts', href: '/dashboard/deleted-accounts', icon: ShieldCheck },
      { name: 'App Versions', href: '/dashboard/app-versions', icon: Smartphone },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

const pageDescriptions: Record<string, string> = {
  '/dashboard': 'Live admin overview',
  '/dashboard/users': 'Passenger accounts',
  '/dashboard/drivers': 'Driver accounts',
  '/dashboard/driver-verification': 'Driver review queue',
  '/dashboard/merchants': 'Merchant applications',
  '/dashboard/food-orders': 'Delivery order activity',
  '/dashboard/trips': 'Trip monitoring',
  '/dashboard/service-areas': 'Coverage management',
  '/dashboard/payments': 'Payment verification',
  '/dashboard/deleted-accounts': 'Account recovery blocks',
  '/dashboard/app-versions': 'Release controls',
  '/dashboard/settings': 'Platform settings',
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [sidebarCounts, setSidebarCounts] = useState<Record<string, number>>({});

  const menuItems = useMemo(() => navGroups.flatMap((group) => group.items), []);
  const badgeCounts = sidebarCounts;
  const currentPage = menuItems.find((item) => item.href === pathname)?.name || 'Dashboard';
  const currentDescription = pageDescriptions[pathname] || 'Pasakay operations';
  const adminInitial = (adminName || 'A').charAt(0).toUpperCase();

  useEffect(() => {
    const cached = localStorage.getItem('cachedLogoUrl');
    if (cached) {
      setLogoUrl(cached);
    }
    setLogoLoaded(true);
  }, []);

  useEffect(() => {
    const endExpiredSession = async () => {
      clearAdminSession();
      await signOut(auth).catch((error) => console.error('Session sign out error:', error));
      router.push('/pasakay/login?expired=1');
    };

    const adminUser = getStoredAdminSession();
    if (!adminUser) {
      endExpiredSession();
      return;
    }

    setAdminName(adminUser.name || 'Admin');

    const timeoutId = window.setTimeout(
      endExpiredSession,
      getAdminSessionTimeRemaining(adminUser)
    );

    const appRef = ref(database, 'settings/app');
    const unsubscribe = onValue(
      appRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const newLogoUrl =
            typeof data.logoUrl === 'string' && data.logoUrl.trim() !== ''
              ? data.logoUrl.trim()
              : null;

          setLogoUrl(newLogoUrl);

          if (newLogoUrl) {
            localStorage.setItem('cachedLogoUrl', newLogoUrl);
          } else {
            localStorage.removeItem('cachedLogoUrl');
          }
        } else {
          setLogoUrl(null);
          localStorage.removeItem('cachedLogoUrl');
        }
      },
      (error) => {
        console.error('Error loading logo:', error);
      }
    );

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    const adminUser = getStoredAdminSession();
    if (!adminUser) return;

    const notificationsRef = ref(database, 'notifications');
    const unsubscribe = onValue(
      notificationsRef,
      (snapshot) => {
        const nextCounts: Record<string, number> = {};
        let totalUnread = 0;
        const notifications = snapshot.val() || {};

        Object.values(notifications as Record<string, any>).forEach((notification) => {
          if (notification?.isRead === true) return;
          if (!isAdminNotificationTarget(notification, adminUser.userId)) return;
          if (!isAdminNotificationType(notification)) return;

          const route = getAdminNotificationRoute(notification);
          if (!route) return;

          totalUnread += 1;
          nextCounts[route] = (nextCounts[route] || 0) + 1;
        });

        if (totalUnread > 0) {
          nextCounts['/dashboard'] = totalUnread;
        }

        setSidebarCounts(nextCounts);
      },
      (error) => console.error('Error loading sidebar notification badges:', error)
    );

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      clearAdminSession();
      router.push('/pasakay/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8f5] text-[#18211f]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(31,111,104,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(31,111,104,0.05) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#18211f]/45 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 h-full w-72 transform border-r border-[#dfe5e1] bg-[#fbfcf9]/95 shadow-[0_24px_80px_rgba(24,33,31,0.10)] backdrop-blur-xl transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[#e5e2d8] px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="flex min-w-0 items-center gap-3 rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-[#1f6f68]/25"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[#dfe5e1] bg-white p-1.5 shadow-sm">
                  <img
                    src={logoLoaded && logoUrl ? logoUrl : '/pasakay-logo.jpg'}
                    alt="Pasakay Logo"
                    className="h-full w-full rounded-sm object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/pasakay-logo.jpg';
                    }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-bold tracking-tight text-[#18211f]">
                    Pasakay
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#66736f]">
                    Admin Console
                  </span>
                </span>
              </Link>

              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-md p-2 text-[#6c7672] transition hover:bg-[#edf0eb] hover:text-[#18211f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/25 lg:hidden"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-md border border-[#cfe4df] bg-[#eff8f5] px-3 py-2 text-[#1f6f68]">
              <Radio className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-[0.14em]">Realtime active</span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-5">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#89918d]">
                    {group.label}
                  </div>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      const badgeCount = badgeCounts[item.href] || 0;
                      const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={`
                              group flex min-h-10 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/25
                              ${
                                isActive
                                  ? 'bg-[#1f6f68] text-white shadow-[0_10px_24px_rgba(31,111,104,0.18)]'
                                  : 'text-[#49534f] hover:bg-[#edf0eb] hover:text-[#18211f]'
                              }
                            `}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate font-semibold">{item.name}</span>
                            {badgeCount > 0 && (
                              <span
                                className={`
                                  ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none
                                  ${
                                    isActive
                                      ? 'bg-white text-[#1f6f68]'
                                      : 'bg-[#b42318] text-white shadow-sm'
                                  }
                                `}
                                aria-label={`${badgeCount} updates`}
                              >
                                {badgeLabel}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          <div className="border-t border-[#e5e2d8] p-4">
            <div className="mb-3 rounded-md border border-[#dfe5e1] bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e8f4f2] text-[#1f6f68]">
                  <span className="text-sm font-bold">{adminInitial}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#18211f]">{adminName || 'Admin'}</p>
                  <p className="mt-0.5 text-xs text-[#66736f]">Administrator</p>
                </div>
                <ShieldCheck className="h-4 w-4 text-[#1f6f68]" />
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-[#b42318] transition hover:bg-[#f8e7e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318]/20"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="relative lg:ml-72">
        <header className="sticky top-0 z-30 border-b border-[#dfe5e1] bg-[#f6f8f5]/92 backdrop-blur-xl">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-md border border-[#dfe5e1] bg-white p-2 text-[#49534f] shadow-sm transition hover:bg-[#edf0eb] hover:text-[#18211f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/25 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a837f]">
                  {currentDescription}
                </p>
                <h2 className="truncate text-lg font-bold text-[#18211f]">{currentPage}</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-md border border-[#cfe4df] bg-white px-3 py-2 text-[#1f6f68] shadow-sm md:flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.12em]">Live</span>
              </div>
              <NotificationBell />
              <div className="hidden items-center gap-2 rounded-md border border-[#dfe5e1] bg-white py-1.5 pl-1.5 pr-3 shadow-sm md:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e8f4f2] text-[#1f6f68]">
                  <span className="text-sm font-bold">{adminInitial}</span>
                </div>
                <span className="max-w-32 truncate text-sm font-semibold text-[#49534f]">
                  {adminName || 'Admin'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-content min-h-[calc(100vh-65px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
