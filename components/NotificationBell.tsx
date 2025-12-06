'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, Check, Trash2 } from 'lucide-react';
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
        return '🚗';
      case 'tripAccepted':
        return '✅';
      case 'tripCancelled':
        return '❌';
      case 'tripCompleted':
        return '🏁';
      case 'paymentVerified':
        return '💳';
      default:
        return '🔔';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[500px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No notifications</p>
                <p className="text-sm">You&apos;ll see notifications here</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.firebaseKey || notification.notificationId}
                  className={`
                    px-4 py-3 border-b hover:bg-gray-50 transition-colors cursor-pointer
                    ${!notification.isRead ? 'bg-blue-50' : ''}
                  `}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      {!notification.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification);
                          }}
                          className="p-1 text-gray-400 hover:text-green-600 rounded"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
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
