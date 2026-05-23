'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, Check, Trash2, AlertTriangle, Car, CreditCard, MapPin, CheckCircle2 } from 'lucide-react';
import { database } from '@/lib/firebase';
import { ref, onValue, off, update, remove, get } from 'firebase/database';

interface Notification {
  notificationId: string;
  targetUserId: string;
  title: string;
  message: string;
  type: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
  firebaseKey?: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get admin UID from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const adminUser = localStorage.getItem('adminUser');
      if (adminUser) {
        const user = JSON.parse(adminUser);
        // Check both 'userId' and 'uid' for compatibility
        const uid = user.userId || user.uid;
        console.log('Admin UID loaded:', uid);
        setAdminUid(uid);
      }
    }
  }, []);

  // Listen for notifications
  useEffect(() => {
    if (!adminUid) {
      console.log('No admin UID, skipping notification listener');
      return;
    }

    console.log('Setting up notification listener for admin:', adminUid);
    const notificationsRef = ref(database, 'notifications');
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      console.log('Notifications snapshot received, exists:', snapshot.exists());
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const notificationsList: Notification[] = [];
        let totalCount = 0;
        let matchedCount = 0;
        
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          totalCount++;
          // Check if notification is for this admin
          // Include notifications where targetUserId matches admin OR is empty (admin notifications)
          const isAdminNotification = 
            value.targetUserId === adminUid || 
            value.targetUserId === '' || 
            value.targetUserId === null ||
            value.targetUserId === undefined;
          
          // Only include admin-type notifications (payment, driver registration, etc.)
          const isAdminType = value.title?.includes('Payment') || 
            value.title?.includes('Driver') || 
            value.title?.includes('Verification') ||
            value.title?.includes('Registration') ||
            value.title?.includes('SOS') ||
            value.title?.includes('Alert') ||
            value.type === 'admin' ||
            value.type === 'general';
          
          if (isAdminNotification && isAdminType) {
            matchedCount++;
            notificationsList.push({
              ...value,
              firebaseKey: key,
            });
          }
        });
        
        console.log(`Notifications: ${matchedCount} admin notifications out of ${totalCount} total`);
        
        // Sort by createdAt (newest first)
        notificationsList.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setNotifications(notificationsList);
      } else {
        console.log('No notifications in database');
        setNotifications([]);
      }
    }, (error) => {
      console.error('Error listening to notifications:', error);
    });

    return () => {
      off(notificationsRef);
    };
  }, [adminUid]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationRoute = (notification: Notification): string | null => {
    const title = notification.title?.toLowerCase() || '';
    const type = notification.type?.toLowerCase() || '';
    
    // Driver registration -> Driver Verification page
    if (title.includes('driver') && (title.includes('registration') || title.includes('registered'))) {
      return '/dashboard/driver-verification';
    }
    
    // Payment notifications -> Payments page
    if (title.includes('payment') || title.includes('receipt')) {
      return '/dashboard/payments';
    }
    
    // Trip notifications -> Trips page
    if (title.includes('trip') || type.includes('trip')) {
      return '/dashboard/trips';
    }
    
    // SOS/Alert notifications -> Trips page (to see the trip)
    if (title.includes('sos') || title.includes('alert') || title.includes('emergency')) {
      return '/dashboard/trips';
    }
    
    // Verification notifications -> Driver Verification
    if (title.includes('verification') || title.includes('verified')) {
      return '/dashboard/driver-verification';
    }
    
    return null;
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    await markAsRead(notification);
    
    // Get the route to navigate to
    const route = getNotificationRoute(notification);
    
    if (route) {
      setIsOpen(false);
      router.push(route);
    }
  };

  const markAsRead = async (notification: Notification) => {
    if (!notification.firebaseKey || notification.isRead) return;
    
    try {
      await update(ref(database, `notifications/${notification.firebaseKey}`), {
        isRead: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      for (const notification of unreadNotifications) {
        if (notification.firebaseKey) {
          await update(ref(database, `notifications/${notification.firebaseKey}`), {
            isRead: true
          });
        }
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notification: Notification) => {
    if (!notification.firebaseKey) return;
    
    try {
      await remove(ref(database, `notifications/${notification.firebaseKey}`));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'tripRequest':
        return <Car className="h-4 w-4" />;
      case 'tripAccepted':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'tripCancelled':
        return <X className="h-4 w-4" />;
      case 'tripCompleted':
        return <MapPin className="h-4 w-4" />;
      case 'paymentVerified':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md border border-[#dfe5e1] bg-white p-2 text-[#49534f] shadow-sm transition hover:bg-[#edf0eb] hover:text-[#18211f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f68]/25"
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#b42318] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 max-h-[500px] w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#dfe5e1] bg-white shadow-[0_24px_60px_rgba(24,33,31,0.16)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e5e2d8] bg-[#fbfcf9] px-4 py-3">
            <div>
              <h3 className="font-semibold text-[#18211f]">Notifications</h3>
              <p className="mt-0.5 text-xs text-[#7a837f]">{unreadCount} unread</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="rounded-md px-2 py-1 text-xs font-bold text-[#1f6f68] transition hover:bg-[#dfe9e6]"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-[#7a837f] transition hover:bg-[#edf0eb] hover:text-[#18211f]"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-[#7a837f]">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f2efe7]">
                  <Bell className="h-5 w-5 text-[#89918d]" />
                </div>
                <p className="font-medium text-[#18211f]">No notifications</p>
                <p className="text-sm">Updates will appear here.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.firebaseKey || notification.notificationId}
                  className={`
                    cursor-pointer border-b border-[#f0ede5] px-4 py-3 transition-colors hover:bg-[#fbfcf9]
                    ${!notification.isRead ? 'bg-[#eef7f4]' : 'bg-white'}
                  `}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[#1f6f68] ring-1 ring-[#dfe5e1]">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'} text-[#18211f]`}>
                        {notification.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-[#66736f]">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-[#89918d]">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification);
                          }}
                          className="rounded p-1 text-[#89918d] transition hover:bg-emerald-50 hover:text-emerald-700"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification);
                        }}
                        className="rounded p-1 text-[#89918d] transition hover:bg-red-50 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
