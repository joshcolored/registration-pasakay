export type AdminSession = {
  userId: string;
  uid?: string;
  email: string;
  name?: string;
  userType?: string;
  sessionCreatedAt: number;
  sessionExpiresAt: number;
};

export type AdminSessionPayload = Omit<AdminSession, 'sessionCreatedAt' | 'sessionExpiresAt'>;

export const ADMIN_SESSION_KEY = 'adminUser';
export const ADMIN_SESSION_DURATION_MS = 60 * 60 * 1000;

const isBrowser = () => typeof window !== 'undefined';

export const createAdminSession = (admin: AdminSessionPayload): AdminSession => {
  const now = Date.now();
  return {
    ...admin,
    sessionCreatedAt: now,
    sessionExpiresAt: now + ADMIN_SESSION_DURATION_MS,
  };
};

export const clearAdminSession = () => {
  if (!isBrowser()) return;
  localStorage.removeItem(ADMIN_SESSION_KEY);
};

export const saveAdminSession = (session: AdminSession) => {
  if (!isBrowser()) return;
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
};

export const getStoredAdminSession = (): AdminSession | null => {
  if (!isBrowser()) return null;

  const rawSession = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!rawSession) return null;

  try {
    const session = JSON.parse(rawSession) as Partial<AdminSession>;
    const sessionUserId = session.userId || session.uid;

    if (!sessionUserId || !session.sessionExpiresAt || Date.now() >= session.sessionExpiresAt) {
      clearAdminSession();
      return null;
    }

    return {
      ...session,
      userId: sessionUserId,
    } as AdminSession;
  } catch {
    clearAdminSession();
    return null;
  }
};

export const getAdminSessionTimeRemaining = (session = getStoredAdminSession()) => {
  if (!session) return 0;
  return Math.max(0, session.sessionExpiresAt - Date.now());
};

export const updateStoredAdminSession = (updates: Partial<AdminSession>) => {
  const session = getStoredAdminSession();
  if (!session) return null;

  const updatedSession = { ...session, ...updates };
  saveAdminSession(updatedSession);
  return updatedSession;
};
