'use client';

import { useState, useEffect } from 'react';
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
  Map
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { auth, database } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { ref, onValue, off } from 'firebase/database';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Load cached logo from localStorage on mount (client-side only)
  useEffect(() => {
    const cached = localStorage.getItem('cachedLogoUrl');
    if (cached) {
      setLogoUrl(cached);
    }
    setLogoLoaded(true);
  }, []);

  // Get admin info from localStorage and load logo with real-time listener
  useEffect(() => {
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) {
      const user = JSON.parse(adminUser);
      setAdminName(user.name || 'Admin');
    }

    // Set up real-time listener for logo
    const appRef = ref(database, 'settings/app');
    const unsubscribe = onValue(appRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newLogoUrl = data.logoUrl && data.logoUrl.trim() !== '' ? data.logoUrl : null;
        
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
    }, (error) => {
      console.error('Error loading logo:', error);
    });

    // Cleanup listener on unmount
    return () => {
      off(appRef);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('adminUser');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/dashboard/users', icon: Users },
    { name: 'Drivers', href: '/dashboard/drivers', icon: Car },
    { name: 'Driver Verification', href: '/dashboard/driver-verification', icon: UserCheck },
    { name: 'Trips', href: '/dashboard/trips', icon: MapPin },
    { name: 'Service Areas', href: '/dashboard/service-areas', icon: Map },
    { name: 'Payments', href: '/dashboard/payments', icon: CreditCard },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white rounded-lg shadow-md flex items-center justify-center p-1">
                <img
                  src={logoLoaded && logoUrl ? logoUrl : "/pasakay-logo.jpg"}
                  alt="Pasakay Logo"
                  className="w-full h-full object-contain rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/pasakay-logo.jpg';
                  }}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Pasakay</h1>
                <p className="text-xs text-gray-500">Admin Panel</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                        ${isActive 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t">
            <div className="flex items-center space-x-3 mb-3 px-4 py-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {adminName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{adminName}</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Bar */}
        <header className="bg-white shadow-sm sticky top-0 z-30">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-700 hover:text-gray-900"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-semibold text-gray-800">
                {menuItems.find(item => item.href === pathname)?.name || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <div className="hidden md:flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {adminName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-700">{adminName}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}

