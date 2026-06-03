export type AdminNotificationLike = {
  title?: string;
  type?: string;
  targetUserId?: string | null;
};

const includesAny = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

export const isAdminNotificationTarget = (
  notification: AdminNotificationLike,
  adminUid: string
) => {
  const target = notification.targetUserId;
  return target === adminUid || target === '' || target === null || target === undefined;
};

export const isAdminNotificationType = (notification: AdminNotificationLike) => {
  const title = String(notification.title || '').toLowerCase();
  const type = String(notification.type || '').toLowerCase();

  if (type === 'admin' || type === 'general') return true;

  return includesAny(`${title} ${type}`, [
    'payment',
    'receipt',
    'driver',
    'verification',
    'registration',
    'merchant',
    'food',
    'order',
    'trip',
    'sos',
    'alert',
    'emergency',
    'deleted',
    'account',
    'app',
    'version',
    'update',
    'settings',
    'passenger',
    'user',
  ]);
};

export const getAdminNotificationRoute = (
  notification: AdminNotificationLike
): string | null => {
  const title = String(notification.title || '').toLowerCase();
  const type = String(notification.type || '').toLowerCase();
  const text = `${title} ${type}`;

  if (
    includesAny(text, ['driververification', 'driverregistration', 'driververified', 'driverrejected']) ||
    (includesAny(text, ['driver', 'verification']) &&
      includesAny(text, ['registration', 'registered', 'verification', 'verified', 'rejected']))
  ) {
    return '/dashboard/driver-verification';
  }

  if (includesAny(text, ['merchant'])) return '/dashboard/merchants';
  if (includesAny(text, ['food', 'order'])) return '/dashboard/food-orders';
  if (includesAny(text, ['payment', 'receipt'])) return '/dashboard/payments';
  if (includesAny(text, ['trip', 'sos', 'alert', 'emergency'])) return '/dashboard/trips';
  if (includesAny(text, ['deleted', 'account recovery'])) return '/dashboard/deleted-accounts';
  if (includesAny(text, ['app', 'version', 'update'])) return '/dashboard/app-versions';
  if (includesAny(text, ['passenger', 'user'])) return '/dashboard/users';
  if (includesAny(text, ['settings'])) return '/dashboard/settings';

  return type === 'admin' || type === 'general' ? '/dashboard' : null;
};
