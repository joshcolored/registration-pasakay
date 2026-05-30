import { ref, get, push, set } from 'firebase/database';
import { database } from '@/lib/firebase';

type AdminNotificationType =
  | 'admin'
  | 'driverRegistration'
  | 'merchantRegistration'
  | 'paymentSubmitted'
  | 'paymentVerified'
  | 'paymentRejected'
  | 'driverVerified'
  | 'driverRejected'
  | 'merchantVerified'
  | 'merchantRejected'
  | 'merchantSuspended'
  | 'foodOrder'
  | 'trip'
  | 'settings';

type AdminNotificationInput = {
  title: string;
  message: string;
  type?: AdminNotificationType;
  relatedId?: string;
  targetUserId?: string | null;
};

const isAdminUser = (value: any) => {
  const role = String(value?.role || value?.userType || '').trim().toLowerCase();
  return role === 'admin';
};

const createNotificationId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const createAdminNotification = async ({
  title,
  message,
  type = 'admin',
  relatedId,
  targetUserId,
}: AdminNotificationInput) => {
  const now = new Date().toISOString();
  const targets = new Set<string>();

  if (targetUserId) {
    targets.add(targetUserId);
  } else {
    try {
      const usersSnapshot = await get(ref(database, 'users'));
      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();
        Object.entries<any>(users).forEach(([uid, value]) => {
          if (isAdminUser(value)) targets.add(uid);
        });
      }
    } catch (error) {
      console.error('Error loading admin users for notification:', error);
    }
  }

  const targetIds = targets.size > 0 ? Array.from(targets) : [''];

  await Promise.all(
    targetIds.map(async (adminId) => {
      const notificationId = createNotificationId();
      const notificationRef = push(ref(database, 'notifications'));

      await set(notificationRef, {
        notificationId,
        targetUserId: adminId,
        title,
        message,
        type,
        relatedId: relatedId || null,
        isRead: false,
        createdAt: now,
        source: 'web-admin',
      });
    })
  );
};
